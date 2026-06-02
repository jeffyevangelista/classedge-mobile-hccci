# PowerSync Sync Rules — Phase C YAML Flip (Disable auto_subscribe on Role-Specific Streams)

**Audience:** Whoever maintains the sync-rules in the JourneyApps Cloud dashboard.

**Asker:** Mobile team. Client now decodes the JWT `role` claim and explicitly subscribes only to streams matching the role. This YAML change flips the 5 role-specific streams to `auto_subscribe: false` so we stop creating empty subscriptions for role-mismatched users. Net effect: AD/PH stop subscribing to 5 streams they previously received zero rows from, Student stops subscribing to 2 teacher streams, Teacher stops subscribing to 3 student streams.

---

## Order of operations

The client code is **already shipped and backward-compatible** with the current YAML (subscribing to an auto-subscribed stream is a no-op). So this YAML change can deploy whenever convenient — no client coordination needed.

After deploy, the SyncCenter panel on the device will show fewer streams per role (only the ones actually relevant + the 4 shared ones).

---

## What changes

Only **5 stream definitions** change. Add `auto_subscribe: false` (or remove the `auto_subscribe: true` line, since `false` is the default once removed) on:

1. `student_enrolled_courses`
2. `courses_and_schedule`
3. `course_materials_and_assessments`
4. `assigned_courses_for_teacher`
5. `current_term_courses`

The other 4 streams keep `auto_subscribe: true` (they're role-agnostic — every authenticated user should receive them):

- `user_identity`
- `current_term_data`
- `user_notifications`
- `announcements_and_events`

**The `with:` block, every query body, and the role gates inside queries all stay exactly as they are.** Only the `auto_subscribe` flag on those 5 streams changes.

---

## Diff to apply

For each of the 5 streams listed above, flip the flag:

```diff
 student_enrolled_courses:
-  auto_subscribe: true
+  auto_subscribe: false
   priority: 1
   query: |
     ...
```

(Repeat for the other 4.)

---

## Expected client behavior per role after this deploys

| Role | Streams the client subscribes to (visible in SyncCenter) |
|---|---|
| **Student** | 4 shared + 3 student-specific = **7 streams** |
| **Teacher** | 4 shared + 2 teacher-specific = **6 streams** |
| **Academic Director** | 4 shared = **4 streams** |
| **Program Head** | 4 shared = **4 streams** |

Before this deploy, every role shows 9 streams in SyncCenter (with the empty ones marked `p?`). After, the role-irrelevant streams disappear entirely from the panel.

---

## Rollback

Flip the 5 `auto_subscribe: false` lines back to `true`. Clients reconnect, every role auto-subscribes to all 9 streams again. The role gates inside queries still filter data, so behavior reverts to the pre-Phase-C state.

---

## What to report back

- SyncCenter screenshot per role after the YAML change reaches the device (should show 7 / 6 / 4 / 4 streams).
- Anything weird in PowerSync service logs.
