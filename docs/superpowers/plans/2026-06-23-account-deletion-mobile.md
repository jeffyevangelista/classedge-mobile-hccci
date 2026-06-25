# Mobile Account-Deletion UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app entry point (Profile tab → "Delete Account" row → dedicated screen) that lets an authenticated user submit a deletion request to the backend's `POST /api/account/deletion-request/` endpoint, with three derived visual states (Intro, Success, Already-Pending) driven by the 201/200 response distinction.

**Architecture:** New `features/account-deletion/` folder with types, axios call, and a TanStack mutation hook. New screen at `screens/profile/DeleteAccountScreen.tsx` (route entry at `app/(main)/profile/delete-account.tsx`) that derives its state from the mutation result — no separate state machine. Existing `ProfileRow` is used as-is (its `iconColor` + `labelClassName` props handle the destructive styling), and a new "Account" section is appended to `ProfileScreen.tsx`.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, Expo Router, TanStack Query, HeroUI Native, the project's `AppInput` wrapper, the project's default-exported `api` axios client at `@/lib/axios`.

## Global Constraints

These values are binding for every task. Copy verbatim — no paraphrasing.

- **Backend endpoint:** `POST /api/account/deletion-request/` (already shipped by sub-project A; backend repo `classedge-2-0`).
- **Request body:** `{ reason?: string, source: "in_app" }`. `reason` is omitted if empty/whitespace-only after trim. `source` is always the literal string `"in_app"`.
- **Response shape (camelCased after `lib/axios.ts` snakeToCamel interceptor):**
  ```ts
  { id: string; submittedAt: string; status: "pending" | "completed" | "cancelled";
    source: "in_app" | "web_form" | "email";
    slaAcknowledgmentBusinessDays: number; slaCompletionDays: number }
  ```
- **HTTP status:** 201 = first create; 200 = idempotent repeat (existing PENDING).
- **DPO contact for cancel:** `inquiries@classify.com.ph` — appears verbatim in the Intro Alert, the Success body, and the Already-Pending body.
- **SLAs in copy:** "5 business days" for acknowledgment, "30 days" for completion.
- **Reason max length:** 500 characters (matches backend `max_length`).
- **Confirmation step:** native `Alert.alert()` with a `style: "destructive"` Request Deletion button. Submit cannot fire without going through this Alert.
- **Axios import:** `import api from "@/lib/axios";` (default export, named `api`).
- **No new tests added** in this plan — manual smoke + backend's tested idempotency. (If the engineer wants to add a snapshot or RTL test, that's out of scope for this plan; do not block on it.)
- **Commits:** Do **not** run `git add` or `git commit` in any task step. Each task ends at a clean commit boundary; the user reviews and commits between tasks.
- **TypeScript:** the project uses strict TypeScript; after each task, the implementer runs `npx tsc --noEmit` (or whatever typecheck script the project's `package.json` defines) and the output should be clean for the new files.

---

## Task 1: Add `features/account-deletion/` — types, API client, mutation hook

**Files:**
- Create: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/account-deletion/account-deletion.types.ts`
- Create: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/account-deletion/account-deletion.api.ts`
- Create: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/account-deletion/account-deletion.hooks.ts`

**Interfaces:**
- Produces:
  - `AccountDeletionResponse`, `AccountDeletionStatus`, `AccountDeletionSource`, `SubmitResult` types.
  - `submitAccountDeletionRequest(reason?: string): Promise<SubmitResult>`.
  - `useSubmitAccountDeletionRequest(): UseMutationResult<SubmitResult, unknown, string | undefined, unknown>`.

- [ ] **Step 1: Create the types file**

Write `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/account-deletion/account-deletion.types.ts`:

```ts
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

- [ ] **Step 2: Create the API client**

Write `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/account-deletion/account-deletion.api.ts`:

```ts
import api from "@/lib/axios";
import type {
  AccountDeletionResponse,
  SubmitResult,
} from "./account-deletion.types";

export async function submitAccountDeletionRequest(
  reason?: string,
): Promise<SubmitResult> {
  const trimmed = reason?.trim() || undefined;
  const response = await api.post<AccountDeletionResponse>(
    "/api/account/deletion-request/",
    {
      reason: trimmed,
      source: "in_app",
    },
  );
  return {
    response: response.data,
    httpStatus: response.status as 200 | 201,
  };
}
```

- [ ] **Step 3: Create the mutation hook**

Write `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/account-deletion/account-deletion.hooks.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { submitAccountDeletionRequest } from "./account-deletion.api";
import type { SubmitResult } from "./account-deletion.types";

export function useSubmitAccountDeletionRequest() {
  return useMutation<SubmitResult, unknown, string | undefined>({
    mutationFn: (reason?: string) => submitAccountDeletionRequest(reason),
  });
}
```

- [ ] **Step 4: Verify TypeScript**

Run:

```
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors mentioning `features/account-deletion/`. Pre-existing errors elsewhere are acceptable but should be noted (the user can decide whether to address them separately).

If errors mention paths in `features/account-deletion/`, fix the offending types or imports before continuing.

**Commit boundary:** "feat(account-deletion): add types, api client, mutation hook".

---

## Task 2: Add the DeleteAccountScreen + route entry

**Files:**
- Create: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/screens/profile/DeleteAccountScreen.tsx`
- Create: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/(main)/profile/delete-account.tsx`

**Interfaces:**
- Consumes: `useSubmitAccountDeletionRequest`, `AccountDeletionResponse` from Task 1.
- Produces: the route `/(main)/profile/delete-account` resolvable via `router.push("/(main)/profile/delete-account")`.

- [ ] **Step 1: Read the existing profile-info screen for the layout convention**

Read `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/(main)/profile/profile-info.tsx` to learn the route-entry pattern (it's a single-component re-export of a screen at `screens/profile/`). Apply the same pattern.

- [ ] **Step 2: Create the screen component**

Write `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/screens/profile/DeleteAccountScreen.tsx`:

```tsx
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, Card } from "heroui-native";
import { AppText } from "@/components/AppText";
import AppInput from "@/components/AppInput";
import ScreenScrollView from "@/components/ScreenScrollView";
import { useSubmitAccountDeletionRequest } from "@/features/account-deletion/account-deletion.hooks";
import type { AccountDeletionResponse } from "@/features/account-deletion/account-deletion.types";

const DPO_EMAIL = "inquiries@classify.com.ph";

const DeleteAccountScreen = () => {
  const [reason, setReason] = useState("");
  const mutation = useSubmitAccountDeletionRequest();

  const handleSubmitPress = () => {
    Alert.alert(
      "Request account deletion?",
      `We'll process your request within 30 days. To cancel before then, contact ${DPO_EMAIL}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Deletion",
          style: "destructive",
          onPress: () => mutation.mutate(reason.trim() || undefined),
        },
      ],
    );
  };

  if (mutation.data?.httpStatus === 201) {
    return <SuccessState response={mutation.data.response} />;
  }
  if (mutation.data?.httpStatus === 200) {
    return <AlreadyPendingState response={mutation.data.response} />;
  }

  return (
    <ScreenScrollView contentContainerClassName="p-4 gap-6">
      <View className="gap-4">
        <AppText className="text-2xl font-semibold">Delete Account</AppText>

        <AppText className="text-base leading-6">
          Submitting this request asks our Data Protection Officer to delete
          your Classedge account.
        </AppText>

        <View className="gap-2">
          <AppText className="text-base font-semibold">
            What will be deleted
          </AppText>
          <AppText className="text-base leading-6">
            Your profile, credentials, gamification records, your chat
            messages, notification preferences, and recent login history.
          </AppText>
        </View>

        <View className="gap-2">
          <AppText className="text-base font-semibold">
            What we may retain
          </AppText>
          <AppText className="text-base leading-6">
            Academic transcripts and grade history (controlled by your school),
            legal-consent records, and operational audit logs. See our Privacy
            Policy for full details.
          </AppText>
        </View>

        <View className="gap-2">
          <AppText className="text-base font-semibold">Timing</AppText>
          <AppText className="text-base leading-6">
            We acknowledge requests within 5 business days and aim to complete
            deletion within 30 days. You'll continue using Classedge normally
            until the request is processed.
          </AppText>
        </View>
      </View>

      <View className="gap-2">
        <AppText className="text-base font-semibold">Reason (optional)</AppText>
        <AppInput
          value={reason}
          onChangeText={setReason}
          placeholder="Help our DPO understand the context"
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />
      </View>

      {mutation.isError ? (
        <Card className="bg-danger/10 p-3">
          <AppText className="text-base text-danger">
            Something went wrong submitting your request. Check your connection
            and try again, or email {DPO_EMAIL}.
          </AppText>
          <Button
            onPress={() => {
              mutation.reset();
              mutation.mutate(reason.trim() || undefined);
            }}
            className="mt-3"
          >
            Retry
          </Button>
        </Card>
      ) : null}

      <Button
        onPress={handleSubmitPress}
        disabled={mutation.isPending}
        className="bg-transparent border border-danger"
      >
        <AppText className="text-danger font-semibold">
          {mutation.isPending ? "Submitting…" : "Request Account Deletion"}
        </AppText>
      </Button>
    </ScreenScrollView>
  );
};

const SuccessState = ({ response }: { response: AccountDeletionResponse }) => {
  const submittedDate = new Date(response.submittedAt).toLocaleDateString();
  return (
    <ScreenScrollView contentContainerClassName="p-4 gap-6">
      <AppText className="text-2xl font-semibold">Request Received</AppText>
      <AppText className="text-base leading-6">
        We received your account deletion request. We aim to complete deletion
        within 30 days. We'll email you when it's done.
      </AppText>
      <AppText className="text-base leading-6">
        To cancel before then, email <AppText weight="semibold">{DPO_EMAIL}</AppText>.
      </AppText>
      <View className="gap-1 mt-4">
        <AppText className="text-xs text-muted">Request ID: {response.id}</AppText>
        <AppText className="text-xs text-muted">Submitted: {submittedDate}</AppText>
      </View>
    </ScreenScrollView>
  );
};

const AlreadyPendingState = ({
  response,
}: {
  response: AccountDeletionResponse;
}) => {
  const submittedDate = new Date(response.submittedAt).toLocaleDateString();
  return (
    <ScreenScrollView contentContainerClassName="p-4 gap-6">
      <AppText className="text-2xl font-semibold">
        Request Already Submitted
      </AppText>
      <AppText className="text-base leading-6">
        You submitted an account deletion request on {submittedDate}. We'll
        complete it within 30 days of that date.
      </AppText>
      <AppText className="text-base leading-6">
        To cancel, email <AppText weight="semibold">{DPO_EMAIL}</AppText>.
      </AppText>
      <View className="gap-1 mt-4">
        <AppText className="text-xs text-muted">Request ID: {response.id}</AppText>
      </View>
    </ScreenScrollView>
  );
};

export default DeleteAccountScreen;
```

Note: the `AppText`, `Button`, `Card`, `ScreenScrollView`, and `AppInput` imports use the project's existing components. If a particular import path differs from what's shown (e.g., `ScreenScrollView` may be a default vs named export), check the source file at `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/components/ScreenScrollView.tsx` and adjust the import line accordingly — but do not rewrite the screen logic.

If `AppInput` (which wraps `heroui-native`'s `Input`) does not accept the `multiline` / `numberOfLines` props (HeroUI Native may not forward them to the underlying TextInput), replace the `<AppInput .../>` block with React Native's `<TextInput multiline numberOfLines={4} ... />` directly, applying the same Tailwind classes the rest of the form uses. The screen's behavior is unchanged.

- [ ] **Step 3: Create the route entry**

Write `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/(main)/profile/delete-account.tsx`:

```tsx
import DeleteAccountScreen from "@/screens/profile/DeleteAccountScreen";

const DeleteAccountRoute = () => {
  return <DeleteAccountScreen />;
};

export default DeleteAccountRoute;
```

- [ ] **Step 4: Verify TypeScript**

Run:

```
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npx tsc --noEmit 2>&1 | grep -E "DeleteAccount|account-deletion"
```

Expected: no errors matching those names. If the grep returns nothing, the screen is type-safe.

- [ ] **Step 5: Verify the route resolves**

The route should be automatically registered by Expo Router based on the file path. Run:

```
ls /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/(main)/profile/
```

Confirm `delete-account.tsx` is in the listing alongside `profile-info.tsx`, `class-schedule.tsx`, etc.

**Commit boundary:** "feat(profile): add DeleteAccountScreen + /profile/delete-account route".

---

## Task 3: Append the "Account" section with the Delete Account row to the Profile tab

**Files:**
- Modify: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/screens/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: the route from Task 2.
- Produces: a third `ProfileSection` titled "Account" at the bottom of the screen, containing one row that navigates to `/profile/delete-account`.

- [ ] **Step 1: Read ProfileScreen.tsx**

Read `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/screens/profile/ProfileScreen.tsx`. Note the existing pattern: `ProfileSection title="Records"` contains nav rows; `ProfileSection title="Settings"` contains the theme toggle, resync, and logout. Both sections live inside `<View className="w-full gap-6">` (around line 141 in the original file).

- [ ] **Step 2: Choose an icon**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/components/Icon.tsx` (or wherever `IconName` is defined) and confirm that `TrashIcon` is a valid `IconName`. If not, pick the closest available icon name that suggests deletion (e.g., `TrashSimpleIcon`, `XCircleIcon`). The icon will render in red via the `iconColor` prop.

- [ ] **Step 3: Add the Account section to ProfileScreen.tsx**

Inside the `<View className="w-full gap-6">` that already contains the Records and Settings sections, append a third section after Settings. The full snippet to add (immediately after the closing `</ProfileSection>` of the Settings section, before the closing `</View>` of `w-full gap-6`):

```tsx
<ProfileSection title="Account">
  <Link href="/(main)/profile/delete-account" asChild>
    <ProfileRow
      icon="TrashIcon"
      label="Delete Account"
      iconColor="#ef4444"
      labelClassName="text-red-500"
      accessibilityLabel="Delete account"
      trailing={
        <View>
          <Icon name="CaretRightIcon" size={18} color="#ef4444" />
        </View>
      }
    />
  </Link>
</ProfileSection>
```

If your chosen icon in Step 2 is not `TrashIcon`, substitute the chosen name in two places: the `icon` prop of `ProfileRow` and (if you want a different trailing) the `name` prop of the trailing `Icon`. The hex color `#ef4444` is Tailwind's `red-500` — use the exact same value for icon color and label className for visual consistency.

`Link` and `Icon` are already imported at the top of the file (lines 2 and 12 of the existing source); no new imports needed.

- [ ] **Step 4: Verify TypeScript**

```
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npx tsc --noEmit 2>&1 | grep -E "ProfileScreen"
```

Expected: no new errors.

- [ ] **Step 5: Manual smoke**

Run the dev server (use the existing project script — likely `npm start` or `bun start`):

```
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
bun start
```

Then in iOS Simulator (or Expo Go):
1. Sign in as any student/faculty user.
2. Go to the Profile tab.
3. Confirm the new "Account" section appears below "Records" and "Settings", containing a red "Delete Account" row.
4. Tap the row → `/profile/delete-account` screen loads with the Intro state.
5. Tap "Request Account Deletion" → native Alert appears.
6. Tap Cancel on the Alert → returns to Intro state, no network call.
7. Tap "Request Deletion" on the Alert → screen swaps to Success state with a real request ID and today's date.
8. Tap back, navigate to Delete Account again, tap Submit again → screen swaps to Already-Pending state showing the original submitted date.
9. Sign in to `/admin/accounts/deletionrequest/` on the backend as a superuser → confirm the new row appears with status `pending` and the requester's email.
10. Take screenshots of (a) the Account section in the Profile tab, (b) the Intro state, (c) the Alert dialog, (d) the Success state, (e) the Already-Pending state, (f) the admin row. These are useful for the App Store submission notes.

If any of the above steps fails to behave as described, do **not** declare the task done — investigate and fix or escalate.

**Commit boundary:** "feat(profile): add Account section with Delete Account row".

---

## Self-review notes

- The `TrashIcon` name in Task 3 is the obvious choice but may not exactly match the project's icon set (Phosphor, Heroicons, etc.). The Step 2 check guards against this.
- The `#ef4444` color is hardcoded rather than via a theme token because the project's existing `useThemeColor("muted")` / `useThemeColor("accent")` pattern doesn't expose a "danger" or "destructive" semantic token at the call sites I read. If your project later adds one, swap the literal hex for the token.
- The screen uses default React Native `Alert.alert()` instead of a HeroUI Dialog because Alert renders the platform-native confirmation UI, which matches what App Store reviewers expect for destructive flows.
- No cache invalidation is performed after a successful submit. The mutation result is the source of truth for what the screen renders, and no other surface in the app needs to know about the pending deletion request.
- Sub-project A's spec §10 deferred items remain deferred here: no in-app cancel, no pending-state hydration on cold launch, no push on completion. The screen says "email DPO" for all three.
