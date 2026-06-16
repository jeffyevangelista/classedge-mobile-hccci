# User Activity Tracking — Mobile → Existing Audit Log

**Status:** Design approved (2026-06-15) — pending implementation plan.
**Scope:** Wire the mobile client into the server's existing `logs.UserActivityLog` audit system so student/teacher mobile actions appear on the same admin/teacher/student dashboards that already display web activity.

---

## 1. Motivation

The server already operates a mature audit system:

- `logs.UserActivityLog` model with a curated 14-action taxonomy.
- `logs.utils.log_user_action()` helper that persists a row **and broadcasts over WebSocket** to three role-scoped channel groups (`audit_admin`, `audit_user_<id>`, `audit_teacher_<id>`).
- Three live dashboards: `/audit/dashboard/` (admin KPIs + charts), `/audit-log/` (admin feed), `/audit-log/teacher/` (teacher's students), `/audit-log/me/` (student's own history).
- A `prune_audit_log` management command for retention.

The web app is fully wired (course views, module CRUD, activity CRUD, answer submission all call `log_user_action`). **The mobile client emits nothing today** — it has no `track()`/`logEvent()` calls. Mobile-originated JWT API endpoints do not hit the Django `@login_required` views where `log_user_action()` is invoked, so mobile users are effectively invisible to the audit feed.

Result: dashboards are blind to a growing share of activity, undercounting student engagement and making teacher-side "what did my students do this week" answers wrong.

This design plugs that hole by emitting semantic audit events from mobile to a new ingest endpoint that calls the same `log_user_action()` helper — so mobile events appear on the same dashboards, with the same live broadcasts, indexed and pruned by the same machinery.

## 2. Non-goals

- **No general click/tap heatmap tracking.** Raw `(x, y)` taps add privacy and storage cost without helping any audience that reads these dashboards.
- **No third-party analytics (PostHog/Mixpanel/Amplitude).** Existing infra is sufficient; vendor cost and a second pipeline are not justified at HCCCI's user scale.
- **No PowerSync table for events.** PowerSync is for *state*; events are append-only and don't need bidirectional sync or conflict resolution.
- **No funnel/retention reporting in v1.** Same emit point can fan out to a second sink later if a PM ever wants funnels.
- **No web-side changes.** Existing web emit points and dashboards stay untouched. Only the model gains two nullable columns.

## 3. Architecture

```
┌──────────────────── MOBILE ─────────────────────┐         ┌─────────────────── SERVER ───────────────────┐
│                                                  │         │                                              │
│  emit point ─┐                                   │         │   POST /api/logs/events/                     │
│              │                                   │         │   (DRF + JWT, role-gated)                    │
│   ┌──────────▼──────────┐                        │ HTTPS   │           │                                 │
│   │ activity-tracker    ├─── batched POST ──────►├─────────►   IngestEventsView                          │
│   │  - track(action,…)  │     (every 10s /       │         │           │                                 │
│   │  - persist to MMKV  │      20 events /       │         │   for each event:                           │
│   │  - flush on bg      │      AppState bg)      │         │     log_user_action(...) ────► UserActivityLog │
│   │  - retry on NetInfo │                        │         │           │                  + WS broadcast │
│   └──────────▲──────────┘                        │         │                                              │
│              │                                   │         └──────────────────────────────────────────────┘
│   nav listener (expo-router)                     │
│   + explicit emits (submit, notif press, login)  │
└──────────────────────────────────────────────────┘
```

### 3.1 One-sentence overview per layer

- **Emit:** hybrid — auto on screen entry via an expo-router listener + explicit calls for `submit_activity`, `start_activity`, notification press, login, logout.
- **Buffer:** MMKV-backed persist-first FIFO; every `track()` synchronously writes to MMKV before returning.
- **Flush:** every 10s OR 20 queued events OR `AppState` → background/inactive OR logout, whichever first.
- **Server:** new DRF view validates the batch, then iterates and calls the existing `log_user_action()` helper so the WS broadcast still fires and live dashboards update.

## 4. Event taxonomy (v1)

Twelve verbs total. **Bold = already exists server-side**; *italic = new actions to add to `UserActivityLog.ACTION_CHOICES`*.

| Action | Trigger | Auto / Explicit | Entity IDs sent |
|---|---|---|---|
| **`login`** | Mobile auth success (after token persisted) | Explicit | — |
| **`logout`** | User taps sign out | Explicit | — |
| **`open_subject`** | `CourseScreen` mount | Auto (nav) | `subjectId` |
| **`open_lesson`** | Lesson detail screen mount | Auto (nav) | `moduleId` |
| **`open_activity`** | Assessment detail screen mount | Auto (nav) | `activityId`, `subjectId` |
| **`start_activity`** | First answer attempt in a session | Explicit | `activityId` |
| **`submit_activity`** | Submission confirmed | Explicit | `activityId` |
| **`view_score`** | `AttemptReviewScreen` mount | Auto (nav) | `activityId` |
| *`open_notification`* | Notification list row tapped | Explicit | `entityType`, `entityId` |
| *`open_announcement`* | Announcement detail mount | Auto (nav) | `announcementId` (mapped to `entity_id`) |
| *`open_calendar_event`* | Calendar event detail mount | Auto (nav) | `eventId` (mapped to `entity_id`) |
| *`open_profile`* | Profile screen mount | Auto (nav) | — |

**Naming convention:** match the existing server taxonomy. New verbs are lowercase snake_case and follow the `<verb>_<noun>` pattern already established. No additional `ACTION_*` constants are introduced beyond these four.

## 5. Wire payload

### 5.1 Request — batched ingest

```http
POST /api/logs/events/
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "events": [
    {
      "client_event_id": "01j9...",        // cuid2, required, server-side dedupe key
      "action": "open_subject",            // required, must be in ACTION_CHOICES
      "subject_id": 42,                    // optional int (or null)
      "activity_id": null,
      "module_id": null,
      "entity_type": null,                 // optional string, used by open_notification
      "entity_id": null,                   // optional string
      "description": "Opened Math 101",    // optional, ≤255 chars; server fills a default if absent
      "occurred_at": "2026-06-15T14:23:11.402Z"  // required ISO-8601, client wall clock
    }
    // … up to 100 events per batch
  ]
}
```

Snake/camel: `lib/axios.ts` in this project transforms successful **responses** to camelCase but does not transform request bodies. Mobile sends request fields in snake_case to match server model fields directly — no `source=` mapping needed on the serializer.

### 5.2 Response

```json
{
  "accepted":   ["01j9...", "01j9..."],
  "duplicates": ["01j8..."]
}
```

The client deletes both `accepted` and `duplicates` from MMKV. Anything not in either list stays queued for retry.

## 6. Server design

### 6.1 Model changes

Add two nullable columns to `UserActivityLog`:

```python
client_event_id = models.CharField(max_length=32, null=True, blank=True, unique=True, db_index=True)
occurred_at     = models.DateTimeField(null=True, blank=True)
```

**Migration `logs/migrations/0012_useractivitylog_mobile_fields.py`** — `AddField` for both columns; non-breaking, safe to deploy ahead of the mobile client. Web call sites are unaffected (both fields default to NULL).

`created_at` (server receipt time) remains the sort and display key on all dashboards. `occurred_at` is captured for future use (surface offline backfills, accurate timeline reconstruction) but **does not change any existing query** in v1.

### 6.2 New module: `logs/views_mobile.py`

Kept separate from the existing HTML view module so the audit dashboard views and the mobile ingest endpoint can evolve independently.

```python
class IngestEventsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [IsAuthenticated]
    throttle_classes       = [IngestThrottle]

    def post(self, request):
        serializer = IngestEventsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        accepted, duplicates = [], []
        for evt in serializer.validated_data['events']:
            if UserActivityLog.objects.filter(client_event_id=evt['client_event_id']).exists():
                duplicates.append(evt['client_event_id'])
                continue

            subject  = _safe_get(Subject,  evt.get('subject_id'))
            activity = _safe_get(Activity, evt.get('activity_id'))
            module   = _safe_get(Module,   evt.get('module_id'))

            log = log_user_action(
                request.user,
                evt['action'],
                description=evt.get('description') or _default_description(evt['action'], subject, activity),
                subject=subject, activity=activity, module=module,
                request=request,
            )
            if log is not None:
                UserActivityLog.objects.filter(pk=log.pk).update(
                    client_event_id=evt['client_event_id'],
                    occurred_at=evt['occurred_at'],
                )
                accepted.append(evt['client_event_id'])

        return Response({'accepted': accepted, 'duplicates': duplicates})
```

### 6.3 Design decisions and why

1. **Reuse `log_user_action()` instead of `UserActivityLog.objects.create()`.** Non-negotiable: it fires the WebSocket broadcast that drives the live audit dashboards. Bypassing it would mean mobile events save but don't appear in real time.
2. **`client_event_id` written via post-insert `UPDATE` rather than extending `log_user_action`'s signature.** Avoids touching the ~30 existing web call sites. Two SQL statements per event is cheap and the ingest endpoint is the only caller paying that cost.
3. **`_safe_get` for FK resolution.** Mobile may have stale cached IDs (subject deleted server-side, still in mobile cache). Log the event with `subject=None` rather than rejecting the whole batch — completeness > FK strictness for audit data.
4. **Per-event try/except inside the loop.** A single malformed event must not poison the whole batch; failures are skipped (and the client treats them as not-accepted, so they'll retry).
5. **No transaction around the loop.** Each event is independent; broadcasting (a side effect inside `log_user_action`) is best-effort and should not roll back persisted rows.

### 6.4 Throttling

Add to `settings.py`:

```python
REST_FRAMEWORK = {
    ...,
    'DEFAULT_THROTTLE_RATES': {
        ...,
        'activity_ingest': '600/minute',  # 10/s per user — generous; protects against runaway loops
    },
}
```

And declare:

```python
class IngestThrottle(UserRateThrottle):
    scope = 'activity_ingest'
```

`600/min` is intentionally well above expected steady-state (typical mobile user generates < 10 events/min). Headroom is for catch-up flushes when a device returns from a long offline period.

### 6.5 URL wiring

`logs/urls.py`:

```python
path('api/events/', IngestEventsView.as_view(), name='ingest_user_events'),
```

### 6.6 Serializers

`logs/serializers.py` adds:

```python
class IngestEventSerializer(serializers.Serializer):
    client_event_id = serializers.CharField(max_length=32)
    action          = serializers.ChoiceField(choices=UserActivityLog.ACTION_CHOICES)
    subject_id      = serializers.IntegerField(required=False, allow_null=True)
    activity_id     = serializers.CharField(required=False, allow_null=True)  # activity PK is string
    module_id       = serializers.IntegerField(required=False, allow_null=True)
    entity_type     = serializers.CharField(required=False, allow_null=True, max_length=50)
    entity_id       = serializers.CharField(required=False, allow_null=True, max_length=64)
    description     = serializers.CharField(required=False, allow_blank=True, max_length=255)
    occurred_at     = serializers.DateTimeField()

class IngestEventsSerializer(serializers.Serializer):
    events = IngestEventSerializer(many=True, max_length=100)
```

Mobile sends request bodies as snake_case (matching model field names) and the DRF serializer reads them directly — no `source=` mapping needed.

## 7. Mobile client design

### 7.1 New module layout

```
lib/activity-tracker/
  index.ts          // public API: track(), flush()
  queue.ts          // MMKV-backed persist-first FIFO
  flush.ts          // batch POST + retry + dedupe
  navListener.ts    // expo-router screen → action mapper
  registry.ts       // screen name → { action, extractEntityIds(params) }
  types.ts          // ActivityAction, EmitOptions
```

### 7.2 Public API

Kept deliberately minimal:

```ts
export function track(
  action: ActivityAction,
  ids?: {
    subjectId?: number;
    activityId?: string;
    moduleId?: number;
    entityType?: string;
    entityId?: string;
  },
  description?: string,
): void;

export function flush(): Promise<void>;
```

`track()` is synchronous (returns `void`, never a Promise). Call sites stay clean — no `await track(...)`, no `.catch()`.

### 7.3 Queue (`queue.ts`)

- Dedicated MMKV instance with id `activity-events` (separate from auth/storage MMKV to keep concerns isolated).
- One key per event: `evt:<clientEventId>`. Values are JSON-encoded event objects.
- Synchronous enqueue: `enqueue(event)` writes immediately, returning before `track()` returns. MMKV is mmap-backed and writes complete in microseconds, safe to call on the JS thread.
- Cap: **5,000 events**. On overflow, evict the oldest 100 (sorted by clientEventId / occurredAt) and increment an in-memory `droppedSinceLaunch` counter logged on every flush (visible in `__DEV__` only).
- `readBatch(maxN)` iterates keys and returns up to `maxN` events. `deleteAcked(ids)` deletes by clientEventId.

### 7.4 Flush (`flush.ts`)

Triggers:
- `setInterval` every **10s** (cleared when app is backgrounded).
- Queue size ≥ **20** (checked at enqueue time; triggers an immediate flush attempt).
- `AppState` listener: on `change` to `'background'` or `'inactive'` → forced flush.
- `signOut()` → forced flush *before* clearing JWT (see §7.7).

Behaviour:
- Reads up to **100** events.
- POSTs to `/api/logs/events/` via the existing `lib/axios.ts` instance (so JWT + refresh interceptor apply).
- On 200: delete `accepted` ∪ `duplicates` from MMKV.
- On network failure / 5xx: events stay in MMKV. Exponential backoff for next attempt: 5s → 30s → 2min → 5min cap.
- On 401 after refresh fails: pause flushes until next sign-in.
- NetInfo `isConnected` flips false → pause flushes; flips true → flush immediately.

### 7.5 Navigation auto-emit (`navListener.ts`)

A single `useEffect` mounted in `providers/RootProvider.tsx` subscribes to expo-router pathname changes:

```ts
const pathname = usePathname();
useEffect(() => {
  const entry = screenRegistry[pathname];
  if (!entry) return;
  track(entry.action, entry.extract(currentRouteParams));
}, [pathname]);
```

The registry is a plain object keyed by route path:

```ts
// registry.ts (excerpt)
export const screenRegistry = {
  '/(main)/courses/[subjectId]':
    { action: 'open_subject',  extract: (p) => ({ subjectId: Number(p.subjectId) }) },
  '/(main)/courses/[subjectId]/assessment/[activityId]':
    { action: 'open_activity', extract: (p) => ({
        subjectId: Number(p.subjectId), activityId: String(p.activityId)
      }) },
  '/(main)/courses/[subjectId]/assessment/[activityId]/review':
    { action: 'view_score',    extract: (p) => ({ activityId: String(p.activityId) }) },
  '/(main)/profile':
    { action: 'open_profile',  extract: () => ({}) },
  // ...
} satisfies Record<string, RegistryEntry>;
```

Routes not in the registry → no emit. Adding a new screen is a one-line change to `registry.ts`. (Exact path keys to be confirmed against the actual expo-router file tree during implementation; the patterns above are illustrative.)

### 7.6 Explicit call sites

| Location | Emit |
|---|---|
| `features/auth` sign-in success | `track('login')` after token persisted |
| `features/auth` sign-out | `track('logout')` then `await flush()` then clear tokens |
| Assessment submit-answer mutation `onSuccess` | `track('submit_activity', { activityId })` |
| First answer save in assessment flow (guarded by a ref so it fires once per attempt) | `track('start_activity', { activityId })` |
| Notification list `onPress` handler | `track('open_notification', { entityType, entityId })` |

### 7.7 Sign-out behaviour

When the user signs out, flush the queue under the **outgoing JWT** before clearing tokens:

```ts
async function signOut() {
  track('logout');
  await flush();           // POSTs everything still queued
  await clearTokens();
  // any unflushed remnant (network failure) stays in MMKV and will
  // retry on next sign-in — under the same user, since clientEventIds
  // are tied to the events themselves
}
```

Rationale: those events are legitimately the outgoing user's actions; dropping them would undercount in the audit feed. Server-side dedupe by `client_event_id` prevents double-counting if the user signs back in and a stale row was previously accepted.

### 7.8 Wiring into existing files

- `providers/RootProvider.tsx` — mount the nav listener; start the flush interval; register `AppState` listener.
- `features/auth/*` — 2 explicit emits + flush-on-logout wiring.
- `features/assessment/*` — 2 explicit emits.
- `features/notifications/*` — 1 explicit emit.
- No changes to `lib/axios.ts` (the tracker uses the same axios instance).

## 8. Privacy and retention

- **Identifiability:** mobile events surface the same user identifiers (name, email) on dashboards as web events already do. No new disclosure beyond what is already happening for web actions. No opt-out / pseudonymisation in v1.
- **Retention:** mobile events live under the same `prune_audit_log` policy as web events. No mobile-specific retention. If volume becomes an issue, revisit with per-action retention (e.g. shorter for `open_*`, longer for `submit_activity`, `login`).
- **No PII in event payloads beyond what the model already stores.** No raw input, no screen coords, no search queries.

## 9. Failure modes considered

| Scenario | Outcome |
|---|---|
| App force-quit before flush | Events sit in MMKV; flush on next launch. |
| App crash mid-`track()` | Sub-ms window; at worst one event lost. |
| OS background-kills app | MMKV survives; flush on next launch. |
| Offline for hours/days | Queue grows up to 5,000; older events evicted with `droppedSinceLaunch` counter; flush on reconnect. |
| Network failure mid-POST | Events stay in MMKV; exponential backoff. |
| 401 after refresh fails | Pause flushes; resume on next sign-in. |
| Duplicate batch sent (retry) | Server dedupes by `client_event_id`; client deletes duplicates. |
| Stale FK id from mobile cache | `_safe_get` returns None; event logged with NULL FK rather than batch-rejected. |
| Server WS down | `log_user_action` swallows the broadcast failure; row still persisted. |
| Sign-out with pending events | Flush under outgoing JWT before token clear. |
| User uninstalls before flush | Irrecoverable by definition; events lost. |

## 10. Out of scope (revisit later)

- Funnel/retention analytics layer (PostHog/Mixpanel sink).
- Screen dwell-time tracking.
- Tap-level heatmaps.
- Per-action retention policies.
- "Occurred at" UI surfacing for offline-backfilled events.
- Web-side instrumentation changes.
- Cross-device session reconciliation (mobile + web in the same audit row).

## 11. Open implementation questions

These are deferred to the implementation plan; the design does not depend on their answer:

- Exact expo-router pathname patterns for each screen in `screenRegistry` — confirm against the live file tree.
- Whether `IsAuthenticated` is enough or whether the endpoint should also require `request.user.profile.role` to be set (some users may exist without a profile early in onboarding — confirm during implementation).
