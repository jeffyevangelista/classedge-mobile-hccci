# Refresh-token expiry awareness — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decode and persist the refresh token's `exp` claim so the client can warn an offline user *before* their 30-day session window dies and unsynced data becomes unrecoverable.

**Architecture:** The refresh token is already a signed JWT (RS256). At every `setRefreshToken` call we decode it once, persist `refreshExpiresAt` to MMKV beside the access-token `expiresAt`, and restore it on app launch. A selector hook derives a threshold state (`safe`/`warn`/`critical`/`expired`) from the persisted timestamp + the network state. Two UI surfaces consume the selector: a non-blocking banner in the tab layout (≤ 7 days, > 1 day, while offline), and a one-shot-per-day modal on app foreground (≤ 1 day, while offline).

**Tech Stack:** `jwt-decode` (already a dependency), `react-native-mmkv` (already used), Zustand (existing auth slice), `heroui-native` Dialog, existing `NetworkBanner`-style banner pattern.

## Global Constraints

- **Spec reference:** `docs/superpowers/specs/2026-06-18-refresh-token-expiry-awareness-design.md`.
- **No backend changes.** The refresh token already carries `exp`.
- **Do not auto-stage or commit.** Leave `git add` / `git commit` to the human reviewer; suggested commit messages are provided as guidance only.
- **Refresh token stays in Keychain** via `expo-secure-store`. Only the expiry **timestamp** (a number) goes into MMKV. Never copy the token bytes into MMKV.
- **UI only renders when device is offline** (`!isConnected || !isInternetReachable`). Online users with a working refresh path never see the warning.
- **Telemetry hooks** use existing `captureAuthMessage` from `lib/telemetry`. No new logging infrastructure.

---

### Task 1: Add MMKV storage keys

**Files:**
- Modify: `utils/storage-keys.ts:10-16`

**Interfaces:**
- Produces: `MMKV_KEYS.REFRESH_EXPIRES_AT` (string `"refreshExpiresAt"`), `MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN` (string `"lastRefreshExpiryWarningShown"`).

- [ ] **Step 1: Add the two new keys**

Edit `utils/storage-keys.ts` so the `MMKV_KEYS` object reads:

```ts
export const MMKV_KEYS = {
  ACCESS_TOKEN: "accessToken",
  AUTH_USER: "authUser",
  EXPIRES_AT: "expiresAt",
  FORCED_LOGOUT_NOTICE: "forcedLogoutNotice",
  POWERSYNC_TOKEN: "powersyncToken",
  REFRESH_EXPIRES_AT: "refreshExpiresAt",
  LAST_REFRESH_EXPIRY_WARNING_SHOWN: "lastRefreshExpiryWarningShown",
} as const;
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run from `client-mobile/`:
```bash
pnpm tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `feat(auth): add refresh-token expiry MMKV keys`.

---

### Task 2: Persist `refreshExpiresAt` in the auth slice

**Files:**
- Modify: `features/auth/auth.slice.ts:24-178`

**Interfaces:**
- Consumes: `MMKV_KEYS.REFRESH_EXPIRES_AT` from Task 1.
- Produces:
  - State field `refreshExpiresAt: number | null` on `AuthSlice`.
  - Updated `setRefreshToken(refreshToken: string): Promise<void>` decodes the token and persists `refreshExpiresAt`.
  - `clearCredentials` deletes the MMKV key and resets the state field.
  - `restoreSession` reads the MMKV key and hydrates the state field.

- [ ] **Step 1: Add `refreshExpiresAt` to `AuthState`**

In `features/auth/auth.slice.ts`, edit the `AuthState` type (lines 24-36) to add `refreshExpiresAt`:

```ts
type AuthState = {
  accessToken: string | null;
  powersyncToken: string | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  email: string | null;
  resetToken: string | null;
  otpExpiresAt: number | null;
  oauthPhase: OAuthPhase;
  oauthStartedAt: number | null;
};
```

And the `initialState` (lines 53-65):

```ts
const initialState: AuthState = {
  accessToken: null,
  powersyncToken: null,
  refreshToken: null,
  refreshExpiresAt: null,
  expiresAt: null,
  isAuthenticated: false,
  authUser: null,
  email: null,
  resetToken: null,
  otpExpiresAt: null,
  oauthPhase: "idle",
  oauthStartedAt: null,
};
```

- [ ] **Step 2: Decode and persist `exp` in `setRefreshToken`**

Replace the body of `setRefreshToken` (lines 111-114) with:

```ts
setRefreshToken: async (refreshToken: string) => {
  await setSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY, refreshToken);
  let refreshExpiresAt: number | null = null;
  try {
    const decoded = jwtDecode<Record<string, unknown>>(refreshToken);
    const exp = decoded.exp as number | undefined;
    if (typeof exp === "number") {
      refreshExpiresAt = exp * 1000;
      setMMKVItem(MMKV_KEYS.REFRESH_EXPIRES_AT, refreshExpiresAt);
    }
  } catch (err) {
    console.warn("[AUTH] Could not decode refresh token exp", err);
  }
  set({ refreshToken, refreshExpiresAt });
},
```

- [ ] **Step 3: Clear the key in `clearCredentials`**

In `clearCredentials` (lines 115-122), add the new delete:

```ts
clearCredentials: async () => {
  deleteMMKVItem(MMKV_KEYS.ACCESS_TOKEN);
  deleteMMKVItem(MMKV_KEYS.POWERSYNC_TOKEN);
  deleteMMKVItem(MMKV_KEYS.AUTH_USER);
  deleteMMKVItem(MMKV_KEYS.EXPIRES_AT);
  deleteMMKVItem(MMKV_KEYS.REFRESH_EXPIRES_AT);
  deleteMMKVItem(MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN);
  await deleteSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY);
  set(() => ({ ...initialState }));
},
```

- [ ] **Step 4: Restore the field in `restoreSession`**

In `restoreSession` (lines 123-152), add the read + include in `set`:

```ts
restoreSession: async () => {
  try {
    const accessToken = getMMKVItem<string>(MMKV_KEYS.ACCESS_TOKEN);
    const powersyncToken = getMMKVItem<string>(MMKV_KEYS.POWERSYNC_TOKEN);
    const authUser = getMMKVItem<AuthUser>(MMKV_KEYS.AUTH_USER);
    const expiresAt = getMMKVItem<number>(MMKV_KEYS.EXPIRES_AT);
    const refreshExpiresAt = getMMKVItem<number>(
      MMKV_KEYS.REFRESH_EXPIRES_AT,
    );
    const refreshToken = await getSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY);

    const isAuthenticated = !!(
      accessToken &&
      refreshToken &&
      authUser &&
      expiresAt
    );

    set({
      accessToken,
      powersyncToken,
      refreshToken,
      refreshExpiresAt,
      authUser,
      isAuthenticated,
      expiresAt,
      oauthPhase: "idle",
      oauthStartedAt: null,
    });
  } catch (error) {
    console.warn("Session restore failed:", error);
    set(() => ({ ...initialState }));
  }
},
```

- [ ] **Step 5: TypeScript check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 6: Manual smoke test — fresh login**

1. Sign out of the app.
2. Sign in with a valid account.
3. Open the React Native debugger (or add a temporary log in `setRefreshToken`).
4. Confirm `refreshExpiresAt` is a number ~30 days in the future (`Date.now() + 30 * 24 * 3600 * 1000` ± a few minutes).

- [ ] **Step 7: Manual smoke test — session restore**

1. Force-quit the app.
2. Reopen.
3. Add a temporary log in `restoreSession` to print `refreshExpiresAt`.
4. Confirm the value matches what was persisted in Step 6.

- [ ] **Step 8: Commit (human reviewer)**

Suggested message: `feat(auth): persist refresh-token expiry timestamp`.

---

### Task 3: Build the `useRefreshExpiry` selector hook

**Files:**
- Create: `features/auth/refreshExpiry.ts`

**Interfaces:**
- Consumes: `useStore` from `lib/store`, `refreshExpiresAt`, `isConnected`, `isInternetReachable`.
- Produces:
  - `type RefreshExpiryState = "safe" | "warn" | "critical" | "expired"`
  - `useRefreshExpiry(): { state: RefreshExpiryState; daysRemaining: number | null; shouldShowBanner: boolean; shouldShowModal: boolean }`
  - Thresholds: `> 7 days = safe`, `1–7 days = warn`, `≤ 1 day = critical`, `≤ 0 = expired`.
  - `shouldShowBanner` true when `(state === "warn" || state === "critical") && device offline`.
  - `shouldShowModal` true when `state === "critical" && device offline && lastShown !== today`.

- [ ] **Step 1: Write the failing tests**

Create `features/auth/__tests__/refreshExpiry.test.ts`:

```ts
import { renderHook } from "@testing-library/react-native";
import { useRefreshExpiry } from "../refreshExpiry";
import useStore from "@/lib/store";

const DAY_MS = 24 * 3600 * 1000;

function setStore(partial: Partial<ReturnType<typeof useStore.getState>>) {
  useStore.setState(partial as any);
}

describe("useRefreshExpiry", () => {
  beforeEach(() => {
    setStore({
      refreshExpiresAt: null,
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it("returns safe when refreshExpiresAt is null", () => {
    const { result } = renderHook(() => useRefreshExpiry());
    expect(result.current.state).toBe("safe");
    expect(result.current.daysRemaining).toBeNull();
  });

  it("returns safe when more than 7 days remain", () => {
    setStore({ refreshExpiresAt: Date.now() + 10 * DAY_MS });
    const { result } = renderHook(() => useRefreshExpiry());
    expect(result.current.state).toBe("safe");
    expect(result.current.shouldShowBanner).toBe(false);
  });

  it("returns warn when 1-7 days remain", () => {
    setStore({
      refreshExpiresAt: Date.now() + 3 * DAY_MS,
      isConnected: false,
      isInternetReachable: false,
    });
    const { result } = renderHook(() => useRefreshExpiry());
    expect(result.current.state).toBe("warn");
    expect(result.current.shouldShowBanner).toBe(true);
    expect(result.current.shouldShowModal).toBe(false);
  });

  it("returns critical when <= 1 day remains and offline", () => {
    setStore({
      refreshExpiresAt: Date.now() + 12 * 3600 * 1000,
      isConnected: false,
      isInternetReachable: false,
    });
    const { result } = renderHook(() => useRefreshExpiry());
    expect(result.current.state).toBe("critical");
    expect(result.current.shouldShowBanner).toBe(true);
  });

  it("hides banner when online even if critical", () => {
    setStore({
      refreshExpiresAt: Date.now() + 12 * 3600 * 1000,
      isConnected: true,
      isInternetReachable: true,
    });
    const { result } = renderHook(() => useRefreshExpiry());
    expect(result.current.shouldShowBanner).toBe(false);
  });

  it("returns expired when past expiry", () => {
    setStore({ refreshExpiresAt: Date.now() - DAY_MS });
    const { result } = renderHook(() => useRefreshExpiry());
    expect(result.current.state).toBe("expired");
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:
```bash
pnpm test features/auth/__tests__/refreshExpiry.test.ts
```
Expected: FAIL — `useRefreshExpiry` not yet exported.

- [ ] **Step 3: Write the hook**

Create `features/auth/refreshExpiry.ts`:

```ts
import useStore from "@/lib/store";
import { getMMKVItem } from "@/lib/storage/mmkv-storage";
import { MMKV_KEYS } from "@/utils/storage-keys";

export type RefreshExpiryState = "safe" | "warn" | "critical" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_THRESHOLD_DAYS = 7;
const CRITICAL_THRESHOLD_DAYS = 1;

export function useRefreshExpiry(): {
  state: RefreshExpiryState;
  daysRemaining: number | null;
  shouldShowBanner: boolean;
  shouldShowModal: boolean;
} {
  const refreshExpiresAt = useStore((s) => s.refreshExpiresAt);
  const isConnected = useStore((s) => s.isConnected);
  const isInternetReachable = useStore((s) => s.isInternetReachable);

  if (refreshExpiresAt == null) {
    return {
      state: "safe",
      daysRemaining: null,
      shouldShowBanner: false,
      shouldShowModal: false,
    };
  }

  const msRemaining = refreshExpiresAt - Date.now();
  const daysRemaining = msRemaining / DAY_MS;
  const offline = !isConnected || !isInternetReachable;

  let state: RefreshExpiryState;
  if (msRemaining <= 0) state = "expired";
  else if (daysRemaining <= CRITICAL_THRESHOLD_DAYS) state = "critical";
  else if (daysRemaining <= WARN_THRESHOLD_DAYS) state = "warn";
  else state = "safe";

  const shouldShowBanner =
    offline && (state === "warn" || state === "critical");

  const todayIso = new Date().toISOString().slice(0, 10);
  const lastShown = getMMKVItem<string>(
    MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN,
  );
  const shouldShowModal =
    offline && state === "critical" && lastShown !== todayIso;

  return {
    state,
    daysRemaining: Math.max(0, daysRemaining),
    shouldShowBanner,
    shouldShowModal,
  };
}
```

- [ ] **Step 4: Run the tests**

Run:
```bash
pnpm test features/auth/__tests__/refreshExpiry.test.ts
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `feat(auth): add useRefreshExpiry selector hook`.

---

### Task 4: Build the offline-only banner

**Files:**
- Create: `features/auth/components/RefreshExpiryBanner.tsx`
- Modify: `app/(main)/(drawer)/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `useRefreshExpiry` from Task 3.
- Produces: a `<RefreshExpiryBanner />` component that renders an inline AppText line at the top of the tabs layout when `shouldShowBanner === true`, with copy adapted to `daysRemaining`.

- [ ] **Step 1: Create the banner component**

Create `features/auth/components/RefreshExpiryBanner.tsx`:

```tsx
import { AppText } from "@/components/AppText";
import { useRefreshExpiry } from "@/features/auth/refreshExpiry";
import { useThemeColor } from "heroui-native";
import { View } from "react-native";

const RefreshExpiryBanner = () => {
  const { shouldShowBanner, state, daysRemaining } = useRefreshExpiry();
  const warningColor = useThemeColor("warning");

  if (!shouldShowBanner) return null;

  const days = daysRemaining == null ? 0 : Math.ceil(daysRemaining);
  const isCritical = state === "critical";

  const message = isCritical
    ? "Your offline session expires today — reconnect to keep your unsynced changes."
    : `Your offline session expires in ${days} ${days === 1 ? "day" : "days"} — connect to keep working offline.`;

  return (
    <View
      className="px-4 py-2"
      style={{
        backgroundColor: warningColor,
      }}
    >
      <AppText className="text-xs text-foreground" weight="medium">
        {message}
      </AppText>
    </View>
  );
};

export default RefreshExpiryBanner;
```

- [ ] **Step 2: Mount the banner in the tabs layout**

Read `app/(main)/(drawer)/(tabs)/_layout.tsx` to identify the right insertion point (just below the existing `TabsHeader` or equivalent top-of-tree component). Add `import RefreshExpiryBanner from "@/features/auth/components/RefreshExpiryBanner";` at the top, then render `<RefreshExpiryBanner />` immediately under the topmost container View, above the `Tabs` navigator.

- [ ] **Step 3: TypeScript check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Manual smoke test — banner hidden online**

1. Sign in.
2. Confirm no banner appears on tab screens. (Online + > 7 days remaining = no UI.)

- [ ] **Step 5: Manual smoke test — banner appears offline near expiry**

1. Sign in.
2. In React Native debugger console, run:
   ```js
   require("@/lib/store").default.setState({
     refreshExpiresAt: Date.now() + 3 * 24 * 3600 * 1000,
     isConnected: false,
     isInternetReachable: false,
   });
   ```
3. Navigate to any tab screen.
4. Expected: yellow/warning banner reading "Your offline session expires in 3 days — connect to keep working offline."

- [ ] **Step 6: Commit (human reviewer)**

Suggested message: `feat(auth): show offline session-expiry banner`.

---

### Task 5: Build the one-shot-per-day critical modal

**Files:**
- Create: `features/auth/components/RefreshExpiryModal.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `useRefreshExpiry` from Task 3, `setMMKVItem` from `lib/storage/mmkv-storage`, `captureAuthMessage` from `lib/telemetry`.
- Produces: a `<RefreshExpiryModal />` component that opens when `shouldShowModal === true`, writes today's ISO date to `MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN` on dismiss, and fires telemetry.

- [ ] **Step 1: Create the modal component**

Create `features/auth/components/RefreshExpiryModal.tsx`:

```tsx
import { AppText } from "@/components/AppText";
import { useRefreshExpiry } from "@/features/auth/refreshExpiry";
import { setMMKVItem } from "@/lib/storage/mmkv-storage";
import { captureAuthMessage } from "@/lib/telemetry";
import { MMKV_KEYS } from "@/utils/storage-keys";
import { Button, Dialog } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

const RefreshExpiryModal = () => {
  const { shouldShowModal } = useRefreshExpiry();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShowModal) {
      setOpen(true);
      captureAuthMessage("refresh_expiry_modal_shown");
    }
  }, [shouldShowModal]);

  const dismiss = () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    setMMKVItem(MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN, todayIso);
    captureAuthMessage("refresh_expiry_modal_dismissed");
    setOpen(false);
  };

  return (
    <Dialog isOpen={open} onOpenChange={(o) => (!o ? dismiss() : null)}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <View className="mb-5 gap-3">
            <Dialog.Title>Session expires today</Dialog.Title>
            <Dialog.Description>
              Your offline session ends today. Reconnect to the internet
              now to keep your unsynced changes from being lost.
            </Dialog.Description>
          </View>
          <Button onPress={dismiss}>OK</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default RefreshExpiryModal;
```

- [ ] **Step 2: Mount in root layout**

Edit `app/_layout.tsx`: add `import RefreshExpiryModal from "@/features/auth/components/RefreshExpiryModal";` near the other auth-component imports, then render `<RefreshExpiryModal />` inside the `RootProvider` tree, alongside `<NetworkBanner />` (line ~23 area; place it where overlays sit).

- [ ] **Step 3: TypeScript check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Manual smoke test — modal fires on critical + offline**

1. Sign in.
2. In the debugger:
   ```js
   require("@/lib/storage/mmkv-storage").deleteMMKVItem("lastRefreshExpiryWarningShown");
   require("@/lib/store").default.setState({
     refreshExpiresAt: Date.now() + 6 * 3600 * 1000,
     isConnected: false,
     isInternetReachable: false,
   });
   ```
3. Expected: modal appears with "Session expires today" title.
4. Tap OK. Expected: modal closes; `lastRefreshExpiryWarningShown` is today's ISO date.
5. Re-run the same store update. Expected: modal does **not** reopen (one-shot per day).

- [ ] **Step 5: Manual smoke test — successful refresh clears the warning lock**

1. Bring the device back online.
2. Wait for the next foreground refresh (or trigger it manually by calling `silentRefresh({ force: true })`).
3. Confirm `refreshExpiresAt` is rotated forward by ~30 days.
4. Confirm `state === "safe"` and neither banner nor modal renders.

- [ ] **Step 6: Commit (human reviewer)**

Suggested message: `feat(auth): show one-shot critical modal for imminent refresh expiry`.

---

### Task 6: Telemetry + memory notes

**Files:**
- Modify: `lib/telemetry.ts` (only if `captureAuthMessage` does not already accept arbitrary message strings — verify; usually no change needed).

**Interfaces:**
- Produces: telemetry events `refresh_expiry_modal_shown`, `refresh_expiry_modal_dismissed`, `refresh_expiry_banner_shown` visible in dashboards.

- [ ] **Step 1: Verify telemetry calls fire**

Confirm `lib/telemetry.ts` exports `captureAuthMessage(name: string, ctx?: object)` and that calls from Task 5 reach the configured Sentry / breadcrumb destination. If `captureAuthMessage` requires a typed enum, expand the enum to include the three new event names.

- [ ] **Step 2: Run all tests**

Run:
```bash
pnpm test
```
Expected: all tests pass, including Task 3's `refreshExpiry.test.ts`.

- [ ] **Step 3: Update auto-memory**

Append a project memory note via the `MEMORY.md` index pattern: "Refresh-token expiry awareness landed YYYY-MM-DD — banner ≤ 7d offline, modal ≤ 1d offline (1×/day)." Skip if a memory entry already covers this.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `chore(auth): telemetry + memory note for refresh expiry UX`.

---

## Self-Review checklist

- Spec section "Decisions" item 1 (persist `refreshExpiresAt`): Task 2 covers.
- Spec item 2 (restore on launch): Task 2 step 4.
- Spec item 3 (selector): Task 3.
- Spec item 4 (three thresholds): Task 3 hook + Task 4 (banner) + Task 5 (modal).
- Spec item 5 (online users see nothing): Task 3 `shouldShowBanner`/`shouldShowModal` short-circuits.
- Spec item 6 (modal one-shot per day): Task 5 step 1.
- Spec item 6 (telemetry hooks): Task 5 + Task 6.
- No placeholders. No "TBD". Every code block is complete. Hook signatures consistent across tasks.
