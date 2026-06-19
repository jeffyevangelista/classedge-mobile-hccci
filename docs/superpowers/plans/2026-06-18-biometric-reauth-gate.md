# Biometric re-authentication gate — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate authenticated screens behind an opt-in biometric prompt on cold start and on resume after ≥ 5 minutes of background, harden device-theft access without breaking offline-first or accessibility.

**Architecture:** A new `biometric.slice.ts` in the Zustand store tracks `isLocked`, `biometricEnabled`, and the last-active timestamp. A `useBiometricLock` hook subscribes to `AppState` and arms/disarms the lock based on idle thresholds. When `isLocked && isAuthenticated`, a full-screen overlay (`BiometricLockScreen`) mounts above the protected stack and calls `expo-local-authentication`. PowerSync continues syncing in the background — only the UI is gated.

**Tech Stack:** `expo-local-authentication`, Zustand, React Native `AppState`, MMKV for `biometricEnabled` preference.

## Global Constraints

- **Spec reference:** `docs/superpowers/specs/2026-06-18-biometric-reauth-gate-design.md`.
- **Default off until first ship + announce.** Existing users do not opt in by surprise.
- **Always offer device passcode fallback.** Never block a user without biometrics enrolled.
- **Lock is an in-memory state only.** Cold start resets it to `true` if the toggle is on.
- **Do not block PowerSync sync** — only the UI is gated.
- **Do not auto-stage or commit.** Leave staging and committing to the human reviewer.

---

### Task 1: Add `expo-local-authentication` dependency + config

**Files:**
- Modify: `package.json`
- Modify: `app.config.ts` (iOS `NSFaceIDUsageDescription`)

**Interfaces:**
- Produces: native module available at runtime.

- [ ] **Step 1: Install the library**

Run:
```bash
pnpm add expo-local-authentication
```

- [ ] **Step 2: Add Face ID usage description**

In `app.config.ts`, add to `ios.infoPlist`:

```ts
infoPlist: {
  NSFaceIDUsageDescription:
    "Unlock Classedge to view your classes, assignments, and chat.",
  // ...existing keys
}
```

- [ ] **Step 3: Run a development build**

Run:
```bash
pnpm expo prebuild --clean
pnpm ios   # or android
```
Expected: build succeeds, app launches, biometric API available via JS.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `chore(deps): add expo-local-authentication`.

---

### Task 2: Add the biometric Zustand slice

**Files:**
- Create: `features/auth/biometric.slice.ts`
- Modify: `lib/store/index.ts` (or wherever slices are composed) — register the new slice
- Modify: `utils/storage-keys.ts` — add `MMKV_KEYS.BIOMETRIC_ENABLED`

**Interfaces:**
- Produces:
  - `BiometricState { isLocked: boolean; biometricEnabled: boolean; lastActiveAt: number | null }`
  - `BiometricActions { lock(): void; unlock(): void; setBiometricEnabled(v: boolean): void; markActive(): void }`

- [ ] **Step 1: Add the storage key**

In `utils/storage-keys.ts` add `BIOMETRIC_ENABLED: "biometricEnabled"` to the `MMKV_KEYS` object.

- [ ] **Step 2: Create the slice**

Create `features/auth/biometric.slice.ts`:

```ts
import { getMMKVItem, setMMKVItem } from "@/lib/storage/mmkv-storage";
import { MMKV_KEYS } from "@/utils/storage-keys";
import type { StateCreator } from "zustand";

type BiometricState = {
  isLocked: boolean;
  biometricEnabled: boolean;
  lastActiveAt: number | null;
};

type BiometricActions = {
  lock: () => void;
  unlock: () => void;
  setBiometricEnabled: (v: boolean) => void;
  markActive: () => void;
};

export type BiometricSlice = BiometricState & BiometricActions;

const createBiometricSlice: StateCreator<BiometricSlice> = (set) => ({
  isLocked: getMMKVItem<boolean>(MMKV_KEYS.BIOMETRIC_ENABLED) === true,
  biometricEnabled:
    getMMKVItem<boolean>(MMKV_KEYS.BIOMETRIC_ENABLED) === true,
  lastActiveAt: Date.now(),
  lock: () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false, lastActiveAt: Date.now() }),
  setBiometricEnabled: (v) => {
    setMMKVItem(MMKV_KEYS.BIOMETRIC_ENABLED, v);
    set({ biometricEnabled: v, isLocked: v ? true : false });
  },
  markActive: () => set({ lastActiveAt: Date.now() }),
});

export default createBiometricSlice;
```

- [ ] **Step 3: Register the slice in the store**

In `lib/store/index.ts` (or the equivalent slice composer), import and merge `createBiometricSlice` like the existing slices.

- [ ] **Step 4: TypeScript check + tests**

Run:
```bash
pnpm tsc --noEmit && pnpm test
```
Expected: clean.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `feat(auth): biometric Zustand slice + toggle storage`.

---

### Task 3: Build the lock screen overlay

**Files:**
- Create: `features/auth/components/BiometricLockScreen.tsx`
- Modify: `app/_layout.tsx` — conditionally render the overlay

**Interfaces:**
- Consumes: `biometric.slice` state, `expo-local-authentication`.
- Produces: a full-screen overlay component; calls `LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Classedge", fallbackLabel: "Use passcode" })` on mount and retries on user request.

- [ ] **Step 1: Create the lock screen component**

Create `features/auth/components/BiometricLockScreen.tsx`:

```tsx
import { AppText } from "@/components/AppText";
import useStore from "@/lib/store";
import * as LocalAuthentication from "expo-local-authentication";
import { Button } from "heroui-native";
import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { signOut } from "@/features/auth/signOut";

const BiometricLockScreen = () => {
  const unlock = useStore((s) => s.unlock);

  const promptForUnlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Classedge",
      fallbackLabel: "Use device passcode",
      disableDeviceFallback: false,
    });
    if (result.success) unlock();
  }, [unlock]);

  useEffect(() => {
    promptForUnlock();
  }, [promptForUnlock]);

  return (
    <View className="absolute inset-0 bg-background items-center justify-center px-6 z-50">
      <AppText weight="semibold" className="text-xl">
        Locked
      </AppText>
      <AppText className="text-sm text-muted text-center mt-2">
        Authenticate to continue. Sign out if this is not your device.
      </AppText>
      <View className="mt-6 w-full max-w-xs gap-3">
        <Button onPress={promptForUnlock}>Try again</Button>
        <Button variant="ghost" onPress={() => signOut()}>
          Sign out
        </Button>
      </View>
    </View>
  );
};

export default BiometricLockScreen;
```

- [ ] **Step 2: Mount conditionally in root**

In `app/_layout.tsx`, near the existing `<NetworkBanner />` mount, add:

```tsx
{isAuthenticated && isLocked && <BiometricLockScreen />}
```

Where `isLocked` is selected from `useStore((s) => s.isLocked)`.

- [ ] **Step 3: Manual smoke test**

1. Enable the biometric toggle (Task 4).
2. Background the app for > 5 minutes (Task 5 will install the timer; for now, manually call `useStore.getState().lock()` in the debugger).
3. Foreground.
4. Expected: biometric prompt fires; on success the UI unlocks.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `feat(auth): biometric lock-screen overlay`.

---

### Task 4: Add the Settings toggle row

**Files:**
- Modify: `screens/profile/ProfileScreen.tsx` (or the dedicated Settings screen if one exists)

**Interfaces:**
- Consumes: `biometric.slice` `biometricEnabled`, `setBiometricEnabled`.

- [ ] **Step 1: Render a toggle row in the security section**

Add a `Switch`-bearing row "Require biometric on resume" calling `setBiometricEnabled(value)`. Include a one-line helper text below: "Asks for Face ID / Touch ID when you return to the app after 5 minutes."

- [ ] **Step 2: On enable, verify enrollment**

If `await LocalAuthentication.hasHardwareAsync()` is false or `isEnrolledAsync()` is false, show a toast: "Set up a device passcode and biometric to use this feature," and revert the toggle to off.

- [ ] **Step 3: Manual smoke test**

Toggle on → app locks immediately on backgrounding. Toggle off → no lock.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `feat(profile): biometric-on-resume Settings toggle`.

---

### Task 5: Install `useBiometricLock` foreground-tracker hook

**Files:**
- Create: `features/auth/useBiometricLock.ts`
- Modify: `app/_layout.tsx` — install the hook

**Interfaces:**
- Consumes: `AppState`, `biometric.slice`.
- Produces: idle-tracking effect that calls `lock()` when (returning to active && now − lastActiveAt > 5 min && biometricEnabled).

- [ ] **Step 1: Create the hook**

```ts
// features/auth/useBiometricLock.ts
import useStore from "@/lib/store";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

export function useBiometricLock() {
  const biometricEnabled = useStore((s) => s.biometricEnabled);
  const lock = useStore((s) => s.lock);
  const markActive = useStore((s) => s.markActive);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!biometricEnabled) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        backgroundedAtRef.current = Date.now();
      }
      if (next === "active") {
        const bg = backgroundedAtRef.current;
        if (bg && Date.now() - bg > IDLE_THRESHOLD_MS) {
          lock();
        } else {
          markActive();
        }
        backgroundedAtRef.current = null;
      }
    });
    return () => sub.remove();
  }, [biometricEnabled, lock, markActive]);
}
```

- [ ] **Step 2: Install in root**

In `app/_layout.tsx`, call `useBiometricLock()` next to the existing `useTokenRefresh()` call.

- [ ] **Step 3: Manual smoke test**

1. Toggle biometric on.
2. Background the app, wait 6 min, foreground.
3. Expected: lock screen appears + prompt fires.
4. Background for 1 min, foreground.
5. Expected: no prompt; UI stays unlocked.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `feat(auth): idle-based biometric re-lock`.

---

### Task 6: Integration tests + memory note

- [ ] **Step 1: Run full test suite + manual scenarios**

Run:
```bash
pnpm tsc --noEmit && pnpm test
```
Then run the four manual scenarios in Tasks 3-5.

- [ ] **Step 2: Update auto-memory if useful**

Append a memory: "Biometric re-auth opt-in toggle in Settings — default off, 5-min idle threshold."

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `chore(auth): biometric memory note`.

---

## Self-Review checklist

- Spec "must not break offline-first": uses `expo-local-authentication` only (local). ✅
- Spec "device passcode fallback": Task 3 sets `disableDeviceFallback: false`. ✅
- Spec "no double-prompt": Task 5 only locks after the 5-min idle threshold. ✅
- Spec "Settings toggle, off by default": Task 4 + slice default false. ✅
- Spec "lock screen above all stacks, PowerSync keeps syncing": Task 3 overlay is an absolutely-positioned View; PowerSync is untouched. ✅
- Spec "isLocked in-memory only": slice does not persist `isLocked`, only `biometricEnabled`. ✅
