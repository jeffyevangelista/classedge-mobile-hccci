# Mobile Account-Deletion UI — Design

- Sub-project: B of three (A = backend deletion service, shipped; C = public web form, deferred).
- Repo: `client-mobile` (Expo SDK 54, React Native 0.81, React 19, TanStack Query, HeroUI Native, Expo Router).
- Effective date for shipping: blocker for the next public App Store submission of the HCCCI mobile app — Apple §5.1.1(v) requires the in-app initiation point even though the backend processes asynchronously.
- Source of legal commitments: `classedge-2-0/legal_drafts/eula_v1.0.1.md` §16, `privacy_v1.0.1.md` §11 + Appendix C.
- Backend endpoint already deployed by sub-project A: `POST /api/account/deletion-request/`.

## 1. Goal

Add an in-app entry point that lets an authenticated mobile user submit a request to delete their Classedge account. The entry point lives under Profile in the existing tab navigation, matching the path the legal docs commit to ("Settings → Profile → Delete Account"). The screen explains what gets deleted vs retained, captures an optional reason, and surfaces the backend's idempotent response so a duplicate submit shows "already pending" rather than creating a second row or sending duplicate emails.

This sub-project does **not** ship a user-initiated cancellation endpoint, a pending-state check on cold launch (no GET endpoint exists), or any push notification on completion. The screen routes the user to email the DPO to cancel.

## 2. Decisions log

| Decision | Choice |
|---|---|
| Distribution context | Public App Store + Google Play; Apple §5.1.1(v) requires the in-app initiation point. |
| Backend integration model | Request-only via `POST /api/account/deletion-request/`. Backend executes asynchronously via DPO admin action. |
| Entry point | New row "Delete Account" appended to the Profile tab's row list (alongside Academic Records, Financial Records, Class Schedule). Subtle destructive styling (red label, no fill). |
| Screen flow | Dedicated full-screen route at `/profile/delete-account` with three derived states (Intro, Success, Already-Pending). No bottom sheet. |
| Reason field | Optional multi-line text input on the Intro state; capped at 500 chars (matches backend max_length). |
| Confirmation step | Native `Alert.alert()` with a destructive "Request Deletion" button. Submit cannot fire without going through the Alert. |
| Post-submit landing | Stay on the screen, swap to Success (or Already-Pending) state. User taps the standard navigation Back to leave. |
| Cancel path | "Email `inquiries@classify.com.ph`" — no in-app cancel endpoint exists in sub-project A. |
| Pending hydration on cold launch | Not implemented. No backend GET endpoint. User finds out by tapping Submit (response is 200 with the existing record). |
| Tests | Manual smoke + backend's tested idempotency. No RN test files added in this sub-project. |

## 3. Files

**New:**
- `app/(main)/profile/delete-account.tsx` — Expo Router route entry, re-exports `<DeleteAccountScreen />`.
- `screens/profile/DeleteAccountScreen.tsx` — main component; renders one of three sub-states.
- `features/account-deletion/account-deletion.types.ts` — TS types.
- `features/account-deletion/account-deletion.api.ts` — `submitAccountDeletionRequest(reason?)` axios call.
- `features/account-deletion/account-deletion.hooks.ts` — `useSubmitAccountDeletionRequest()` TanStack mutation hook.

**Modified:**
- The Profile tab list — append a "Delete Account" row that navigates to `/profile/delete-account`. Exact file (likely `screens/profile/ProfileScreen.tsx`) confirmed in the plan.
- `features/profile/components/ProfileRow.tsx` — add a `destructive` boolean prop (red label, no fill) if not already present.

## 4. Endpoint contract (reference — already shipped by sub-project A)

**`POST /api/account/deletion-request/`**

Request body (JSON):
```json
{
  "reason": "string, optional, max 500 chars",
  "source": "in_app"
}
```

Response (camelCased after `lib/axios.ts` snakeToCamel transformation):
```json
{
  "id": "uuid",
  "submittedAt": "2026-06-23T12:34:56Z",
  "status": "pending",
  "source": "in_app",
  "slaAcknowledgmentBusinessDays": 5,
  "slaCompletionDays": 30
}
```

HTTP status: **201** on first create (sends user receipt + DPO notification emails), **200** on idempotent repeat (existing PENDING row returned, no new emails).

Authentication: required. Existing axios client carries the JWT.

## 5. Types

```ts
// features/account-deletion/account-deletion.types.ts

export type AccountDeletionStatus = "pending" | "completed" | "cancelled";
export type AccountDeletionSource = "in_app" | "web_form" | "email";

export interface AccountDeletionResponse {
  id: string;
  submittedAt: string;
  status: AccountDeletionStatus;
  source: AccountDeletionSource;
  slaAcknowledgmentBusinessDays: number;
  slaCompletionDays: number;
}

export interface SubmitResult {
  response: AccountDeletionResponse;
  httpStatus: 200 | 201;
}
```

## 6. API client

```ts
// features/account-deletion/account-deletion.api.ts

import { axios } from "@/lib/axios";
import type { SubmitResult } from "./account-deletion.types";

export async function submitAccountDeletionRequest(
  reason?: string,
): Promise<SubmitResult> {
  const trimmed = reason?.trim() || undefined;
  const r = await axios.post("/api/account/deletion-request/", {
    reason: trimmed,
    source: "in_app",
  });
  return {
    response: r.data,
    httpStatus: r.status as 200 | 201,
  };
}
```

## 7. Mutation hook

```ts
// features/account-deletion/account-deletion.hooks.ts

import { useMutation } from "@tanstack/react-query";
import { submitAccountDeletionRequest } from "./account-deletion.api";

export function useSubmitAccountDeletionRequest() {
  return useMutation({
    mutationFn: (reason?: string) => submitAccountDeletionRequest(reason),
  });
}
```

No cache invalidation. No optimistic update. No custom retry policy on the mutation — the project's existing axios client handles whatever transport-level retries it's configured for, and the screen's inline Retry button drives explicit user retries on failure.

## 8. Screen — three derived states

The DeleteAccountScreen reads `mutation.data` directly:

- `mutation.data === undefined` → render Intro.
- `mutation.data.httpStatus === 201` → render Success.
- `mutation.data.httpStatus === 200` → render Already-Pending.

A separate state machine isn't needed; the mutation result drives the entire flow.

### 8.1 Intro state

Title: **Delete Account**

Body (renders as rich text — sections via headings/strong):

> Submitting this request asks our Data Protection Officer to delete your Classedge account.
>
> **What will be deleted:** your profile, credentials, gamification records, your chat messages, notification preferences, and recent login history.
>
> **What we may retain:** academic transcripts and grade history (controlled by your school), legal-consent records, and operational audit logs. See our Privacy Policy for full details.
>
> **Timing:** we acknowledge requests within 5 business days and aim to complete deletion within 30 days. You'll continue using Classedge normally until the request is processed.

Reason input (`AppInput`, multi-line, `maxLength={500}`, placeholder "Reason (optional)").

Submit button label: "Request Account Deletion". Subtle destructive styling (red text label, no fill). Disabled while `mutation.isPending`.

Tapping Submit opens:

```ts
Alert.alert(
  "Request account deletion?",
  "We'll process your request within 30 days. To cancel before then, contact inquiries@classify.com.ph.",
  [
    { text: "Cancel", style: "cancel" },
    {
      text: "Request Deletion",
      style: "destructive",
      onPress: () => mutation.mutate(reason.trim() || undefined),
    },
  ],
);
```

### 8.2 Success state (201)

Title: **Request Received**

Body:
> We received your account deletion request. We aim to complete deletion within 30 days. We'll email you when it's done.
>
> To cancel before then, email **inquiries@classify.com.ph**.

Footer (small, dim):
- `Request ID: {response.id}`
- `Submitted: {new Date(response.submittedAt).toLocaleDateString()}`

No buttons. Standard navigation back to leave.

### 8.3 Already-Pending state (200)

Title: **Request Already Submitted**

Body:
> You submitted an account deletion request on {date}. We'll complete it within 30 days of that date.
>
> To cancel, email **inquiries@classify.com.ph**.

Footer:
- `Request ID: {response.id}`

No buttons.

## 9. Error handling

- **Network failure** (no response from axios — `error.response` undefined): inline banner above the Submit button on the Intro state — "Couldn't reach the server. Check your connection and try again." with a Retry button that calls `mutation.mutate(reason)` again. Input value preserved.
- **5xx server error:** inline banner — "Something went wrong on our side. Please try again or email `inquiries@classify.com.ph`." with a Retry button.
- **401:** rare in the main app flow; the existing global axios interceptor handles sign-out. No special handling in this screen.
- **400:** prevented client-side (reason is `maxLength`-capped, source is hardcoded). If it surfaces, fall through to the 5xx banner.

The error banner is rendered when `mutation.isError` is true. `mutation.reset()` is called when Retry is tapped so the banner clears and the in-flight state shows correctly.

## 10. Profile tab row — entry point

Locate the existing Profile tab row list (likely `screens/profile/ProfileScreen.tsx` or a child component that renders the Academic Records / Financial Records / Class Schedule rows). Append:

```tsx
<ProfileRow
  label="Delete Account"
  destructive
  onPress={() => router.push("/profile/delete-account")}
/>
```

The `destructive` prop renders the label in red without filling the row background — the row stays subtle. If `ProfileRow` doesn't yet accept a `destructive` boolean, add the prop in the same task that adds the row.

## 11. Layout / components

- `ScreenScrollView` per project convention. `useScrollBottomInset` (per memory: scroll content uses scroll-bottom; pinned bars use safe-bottom — this content is scrollable).
- HeroUI Native components for cards, typography, button. `AppInput` (not heroui-native Input) for the reason input.
- `Alert.alert()` from React Native for the destructive confirmation step.
- The `app/(main)/profile/delete-account.tsx` route inherits the existing profile-sub-routes layout — standard navigation Back, sub-screen header.

## 12. Deferred (sub-project A spec §10 carry-over, plus mobile-specific items)

- **In-app cancel:** backend doesn't expose `DELETE /api/account/deletion-request/<id>/`. The screen tells users to email the DPO.
- **Pending hydration on cold launch:** would require a backend GET endpoint. Without one, the user finds out via 200-vs-201 on Submit.
- **Push notification on completion:** backend sends an email; an in-app push would require new server-side wiring and isn't required by the stores.
- **Localization:** UI copy is English-only. The Classedge audience is institutional (HCCCI) and English is the operating language, so this is acceptable for v1.

## 13. Acceptance criteria

The sub-project is correct and shippable when:

- A user can navigate Profile tab → Delete Account → see the Intro screen.
- The reason input accepts up to 500 characters and rejects more.
- Tapping Submit opens the destructive `Alert.alert()`. Tapping Cancel dismisses without a network call. Tapping Request Deletion fires the mutation.
- On first submit, the screen swaps to the Success state and the request ID is visible.
- On a second submit after the screen is closed and reopened (or the app is killed and relaunched), the screen swaps to the Already-Pending state showing the original submitted date.
- A network failure (airplane mode) on Submit shows the error banner with Retry. Recovering connection and tapping Retry succeeds.
- The Submit button is disabled while the mutation is pending.
- The destructive row in the Profile tab is visible after the existing four rows.
- Manual smoke against a real backend confirms the receipt email lands at the requester's address and the DPO notification lands at `DPO_EMAIL`.
- No additional TypeScript errors after running `tsc --noEmit` (or whatever the project's typecheck script is).

## 14. Out of scope (do not include in the plan)

- Adding new test infrastructure (RTL, Jest, Detox) if not already present.
- Refactoring the existing Profile screen layout.
- Adding a confirmation email "are you sure" flow with a token (handled server-side via the receipt email if needed in the future).
- Showing the deletion-request status anywhere else in the app (e.g., a banner across all screens). Out of scope for this UI.
