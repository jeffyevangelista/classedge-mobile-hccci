# Session-age UI surfacing — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface a tappable "Last synced with server" row in the profile screen, with an explanatory bottom sheet, so users can self-serve their session state without waiting for a forced-logout surprise.

**Architecture:** Builds on top of #1's persisted `refreshExpiresAt` and a new `lastRefreshAt` MMKV key written by `useTokenRefresh` after every successful silent refresh. A small selector hook (`useSessionAge`) returns a relative-time label and the threshold from `refreshExpiry`. The UI is two thin components mounted into `ProfileScreen` — no other touches.

**Tech Stack:** Zustand, MMKV, existing AppText / heroui-native Sheet primitives. No new dependencies.

## Global Constraints

- **Spec reference:** `docs/superpowers/specs/2026-06-18-session-age-ui-design.md`.
- **Depends on #1 (refresh-token expiry awareness) being merged first.** This plan reads `refreshExpiresAt` from #1's MMKV key.
- **No new persistence beyond `lastRefreshAt`.**
- **No modals.** This is a passive, look-when-you-want-to surface.
- **Do not auto-stage or commit.** Leave staging and committing to the human reviewer.

---

### Task 1: Persist `lastRefreshAt` on successful refresh

**Files:**
- Modify: `utils/storage-keys.ts` — add `LAST_REFRESH_AT`
- Modify: `features/auth/useTokenRefresh.ts` — write the key on success
- Modify: `features/auth/auth.slice.ts` — add `lastRefreshAt` state field, restore on launch, clear on logout

**Interfaces:**
- Produces: store field `lastRefreshAt: number | null`.

- [ ] **Step 1: Add the MMKV key**

Append `LAST_REFRESH_AT: "lastRefreshAt"` to `MMKV_KEYS`.

- [ ] **Step 2: Add the state field**

In `auth.slice.ts`, add `lastRefreshAt: number | null` to `AuthState`, `initialState`, and `restoreSession`'s read + set. Add a new action `setLastRefreshAt(ts: number)` that writes MMKV + state. In `clearCredentials`, delete the MMKV key.

- [ ] **Step 3: Write the timestamp on successful refresh**

In `useTokenRefresh.ts`, after the `console.log("[TokenRefresh] Tokens refreshed silently")` line, add:

```ts
useStore.getState().setLastRefreshAt(Date.now());
```

- [ ] **Step 4: TypeScript check + manual smoke**

Run `pnpm tsc --noEmit`. Sign in, wait for the next refresh, confirm `lastRefreshAt` is set.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `feat(auth): persist lastRefreshAt timestamp`.

---

### Task 2: `useSessionAge` selector

**Files:**
- Create: `features/auth/sessionAge.ts`
- Test: `features/auth/__tests__/sessionAge.test.ts`

**Interfaces:**
- Produces: `useSessionAge(): { lastRefreshAt: number | null; refreshExpiresAt: number | null; relativeLastSyncedLabel: string }`.
- "Just now" (< 1 min), "X min ago" (< 1 h), "X hours ago" (< 24 h), "X days ago" (≥ 1 day), "Never" (null).

- [ ] **Step 1: Write the failing test**

```ts
// features/auth/__tests__/sessionAge.test.ts
import { renderHook } from "@testing-library/react-native";
import useStore from "@/lib/store";
import { useSessionAge } from "../sessionAge";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("useSessionAge", () => {
  it("returns 'Never' when lastRefreshAt is null", () => {
    useStore.setState({ lastRefreshAt: null });
    const { result } = renderHook(() => useSessionAge());
    expect(result.current.relativeLastSyncedLabel).toBe("Never");
  });

  it("returns 'Just now' under 1 minute", () => {
    useStore.setState({ lastRefreshAt: Date.now() - 30_000 });
    const { result } = renderHook(() => useSessionAge());
    expect(result.current.relativeLastSyncedLabel).toBe("Just now");
  });

  it("returns minutes for < 1 hour", () => {
    useStore.setState({ lastRefreshAt: Date.now() - 12 * MIN });
    const { result } = renderHook(() => useSessionAge());
    expect(result.current.relativeLastSyncedLabel).toBe("12 min ago");
  });

  it("returns hours for < 1 day", () => {
    useStore.setState({ lastRefreshAt: Date.now() - 5 * HOUR });
    const { result } = renderHook(() => useSessionAge());
    expect(result.current.relativeLastSyncedLabel).toBe("5 hours ago");
  });

  it("returns days for ≥ 1 day", () => {
    useStore.setState({ lastRefreshAt: Date.now() - 4 * DAY });
    const { result } = renderHook(() => useSessionAge());
    expect(result.current.relativeLastSyncedLabel).toBe("4 days ago");
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
pnpm test features/auth/__tests__/sessionAge.test.ts
```
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the hook**

```ts
// features/auth/sessionAge.ts
import useStore from "@/lib/store";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function formatRelative(ts: number | null): string {
  if (ts == null) return "Never";
  const diff = Date.now() - ts;
  if (diff < MIN) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const d = Math.floor(diff / DAY);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

export function useSessionAge() {
  const lastRefreshAt = useStore((s) => s.lastRefreshAt);
  const refreshExpiresAt = useStore((s) => s.refreshExpiresAt);
  return {
    lastRefreshAt,
    refreshExpiresAt,
    relativeLastSyncedLabel: formatRelative(lastRefreshAt),
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test features/auth/__tests__/sessionAge.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `feat(auth): useSessionAge selector hook`.

---

### Task 3: `SessionAgeRow` + `SessionAgeSheet` UI

**Files:**
- Create: `features/auth/components/SessionAgeRow.tsx`
- Create: `features/auth/components/SessionAgeSheet.tsx`
- Modify: `screens/profile/ProfileScreen.tsx` — mount the row

**Interfaces:**
- Consumes: `useSessionAge` from Task 2.
- Produces: a row UI that opens an explanatory sheet on tap.

- [ ] **Step 1: SessionAgeRow component**

```tsx
// features/auth/components/SessionAgeRow.tsx
import { AppText } from "@/components/AppText";
import { useSessionAge } from "@/features/auth/sessionAge";
import { Pressable, View } from "react-native";
import { useState } from "react";
import SessionAgeSheet from "./SessionAgeSheet";

const SessionAgeRow = () => {
  const { relativeLastSyncedLabel } = useSessionAge();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="px-4 py-3 border-b border-muted/20"
      >
        <View className="flex-row justify-between items-center">
          <AppText className="text-sm">Last synced with server</AppText>
          <AppText className="text-sm text-muted">
            {relativeLastSyncedLabel}
          </AppText>
        </View>
      </Pressable>
      <SessionAgeSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default SessionAgeRow;
```

- [ ] **Step 2: SessionAgeSheet component**

```tsx
// features/auth/components/SessionAgeSheet.tsx
import { AppText } from "@/components/AppText";
import { useSessionAge } from "@/features/auth/sessionAge";
import { Button, Dialog } from "heroui-native";
import { View } from "react-native";

type Props = { open: boolean; onClose: () => void };

const SessionAgeSheet = ({ open, onClose }: Props) => {
  const { relativeLastSyncedLabel, refreshExpiresAt } = useSessionAge();
  const daysUntilExpiry =
    refreshExpiresAt != null
      ? Math.max(0, Math.ceil((refreshExpiresAt - Date.now()) / (24 * 3600 * 1000)))
      : null;
  return (
    <Dialog isOpen={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <View className="mb-4 gap-2">
            <Dialog.Title>Session details</Dialog.Title>
            <AppText className="text-sm">
              Last synced with server: {relativeLastSyncedLabel}
            </AppText>
            {daysUntilExpiry != null && (
              <AppText className="text-sm">
                Offline session expires in {daysUntilExpiry}{" "}
                {daysUntilExpiry === 1 ? "day" : "days"}.
              </AppText>
            )}
            <AppText className="text-xs text-muted mt-2">
              Your session refreshes automatically when you are connected.
              You can use the app offline for up to 30 days after your last
              successful refresh.
            </AppText>
          </View>
          <Button onPress={onClose}>Close</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default SessionAgeSheet;
```

- [ ] **Step 3: Mount in ProfileScreen**

In `screens/profile/ProfileScreen.tsx`, add `<SessionAgeRow />` in the appropriate "Account" section.

- [ ] **Step 4: Manual smoke**

1. Sign in.
2. Open Profile → see the row showing "Just now".
3. Tap → sheet appears.
4. Wait > 1 hour → row updates next render.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `feat(profile): session-age row + detail sheet`.

---

### Task 4: Memory note

- [ ] **Step 1: Update auto-memory if useful**

Append a project memory: "Session-age row added to Profile; reads `lastRefreshAt` + `refreshExpiresAt`. Tap to open a sheet explaining the 30-day offline window."

---

## Self-Review checklist

- Spec "no new persistence beyond #1" + `lastRefreshAt`: Task 1 covers. ✅
- Spec "no modals" (only a sheet on user tap): Task 3 uses a Dialog opened only by user tap. ✅
- Spec "always show, even when fresh": Task 3 row always renders; "Just now" is acceptable. ✅
- Spec depends-on-#1: Task 1's writes feed Task 2's reads; rest of the chain consumes `refreshExpiresAt` from #1. ✅
