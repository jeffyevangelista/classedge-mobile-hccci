# Layered Chrome — Tab Bar, Home Header, Screen Background Design

**Status:** approved
**Date:** 2026-05-04
**Scope:** Re-theme the bottom tab bar, the Home-tab `TabsHeader`, and the default screen background to use the Royal Azure semantic tokens. Introduce a "layered depth" structural style: body uses a recessed surface, header and tab bar sit on a raised surface, with hairline borders.

This builds on the Royal Azure theme already merged in commit `88a4e5f`.

---

## Goals

- Replace hardcoded `#ffffff` / `#1c1c1e` chrome colors in `app/(main)/(tabs)/_layout.tsx` with HeroUI Native theme tokens so chrome follows light/dark.
- Establish visible layering between body and chrome via two surface tones (`surface-tertiary` for body, `surface` for header + tab bar).
- Add an explicit active-tab indicator (3×24px pill) that does not rely on color alone for focus communication.
- Make screens explicitly declare their background color via the `Screen` component, so the rendered surface stops depending on whatever sits behind the navigator.

## Non-goals

- Inner-page Stack headers on Calendar, Notifications, Teaching, Oversight tabs (out of scope; would unify the second header pattern — deferred).
- `utils/colors.ts` `primary[]` migration (out of scope; orphan ramp still used by `ScheduleComponent.tsx` and `LoginScreen.tsx`).
- Tab bar layout/animation changes — keep the existing `Animated.View` insets-aware wrapper.
- TabsHeader content changes (greeting + name + sync + avatar layout untouched).

## Constraints (from user decisions)

1. Scope **A** chosen: tab bar + Home header + screen background only. No inner-page header changes, no `colors.primary[]` migration.
2. Structural style **B** chosen: layered depth (recessed body, raised chrome).
3. Active tab uses accent color **plus** a 3×24px pill indicator under the label.
4. TabsHeader retains its current content; only the surface/border tokens change.

## Token mapping

| Area | Light token / hex | Dark token / hex |
|---|---|---|
| Recessed body (between header & tab bar) | `surface-tertiary` (`#f1f5f9`) | `background` (`#0b1220`) |
| Screen content default (inside `<Screen>`) | `background` (`#ffffff`) | `background` (`#0b1220`) |
| Header bg (TabsHeader) | `surface` (`#ffffff`) | `surface` (`#111a2e`) |
| Tab bar bg | `surface` (`#ffffff`) | `surface` (`#111a2e`) |
| Header & tab bar hairline | `border` (`#e2e8f0`) | `border` (`#1e293b`) |
| Active tab tint (icon + label + pill) | `accent` (`#2563eb`) | `accent` (`#3b82f6`) |
| Inactive tab tint | `muted` (`#64748b`)† | `muted` (`#94a3b8`) |
| Status bar | follows `StatusBar style="auto"` | follows `StatusBar style="auto"` |

**Why two different tokens for the recessed body across modes.** In light mode we want a step *down* from white chrome, so we use `surface-tertiary` (`#f1f5f9`) — slightly off-white. In dark mode, our `surface-tertiary` is `#334155`, which is *lighter* than `surface` (`#111a2e`) — the wrong direction for a recessed feel. So we use `background` (`#0b1220`) for the dark recessed body, which is darker than `surface` and gives the same "chrome floats above body" effect. The raised-vs-recessed relationship holds in both modes; we just pick the token that puts the body *below* the chrome luminance-wise.

† `--muted` in light mode is `#64748b` (slate-500). If actual use shows it reading too dark for an inactive tab tint, surface as follow-up; it's the canonical token for "low-emphasis text" so we honor it here.

## Design decisions detail

### 1. Layering strategy

Three visible layers:

- **Status bar / system chrome** — handled by OS, follows `StatusBar style="auto"`.
- **Raised chrome** (header + tab bar) — `--surface`. Has a 1px hairline bottom (header) / top (tab bar) border in `--border`. No drop shadow — borders are sharper and play better with dark mode.
- **Recessed body** (everything between header and tab bar) — light: `--surface-tertiary` (`#f1f5f9`); dark: `--background` (`#0b1220`).

This creates a "card on a tray" feel: cards inside the body use `--surface` (matching the chrome), so they appear to lift off the recessed background.

### 2. Tab bar configuration

Replace the hardcoded `tabBarBg` constant in `app/(main)/(tabs)/_layout.tsx`:

- **Old:** `const tabBarBg = colorScheme === "dark" ? "#1c1c1e" : "#ffffff";`
- **New:** `const tabBarBg = useThemeColor("surface");`

`screenOptions`:
- `tabBarStyle.backgroundColor = tabBarBg`
- `tabBarStyle.borderTopWidth = StyleSheet.hairlineWidth`
- `tabBarStyle.borderTopColor = useThemeColor("border")`
- `tabBarActiveTintColor = useThemeColor("accent")`
- `tabBarInactiveTintColor = useThemeColor("muted")`
- `headerStyle.backgroundColor = tabBarBg` (header surface matches tab bar)

The existing `Animated.View` that pads/animates the safe-area gutter keeps `backgroundColor: tabBarBg` so the bottom inset matches.

### 3. Active tab indicator (3×24 pill)

React Navigation's bottom tabs don't have a built-in indicator like top tabs. Implement via a wrapper around the existing `TabIcon`:

```tsx
// components/TabIcon.tsx (refactor)
const TabIcon = ({ focused, color, IconElement }: TabIconProps) => {
  return (
    <View className="items-center">
      <Icon
        name={IconElement}
        color={color}
        size={ICON_SIZE}
        weight={focused ? "fill" : "regular"}
      />
      <View
        className={`mt-1 h-[3px] w-6 rounded-full ${focused ? "bg-accent" : "bg-transparent"}`}
      />
    </View>
  );
};
```

The pill renders at all times (transparent when inactive) so the icon position doesn't shift on focus changes.

### 4. Home header (TabsHeader) re-theme

`components/TabsHeader.tsx` currently uses `bg-white dark:bg-neutral-900`. Replace with HeroUI surface tokens and add a hairline:

- **Container className:** `bg-surface px-5 pb-3 flex flex-row justify-between items-center border-b border-border`
- Skeleton variant gets the same change.
- The greeting/name text colors switch from raw slate to `text-muted` / `text-foreground` so they follow the theme.

### 5. Screen background ownership

`components/screen.tsx` currently sets only `flex-1`. Add a default `bg-background` so screens explicitly own their bg color. This means the navigator/recessed-body bleed-through stops mattering — the body color shows only in the gutter between cards.

```tsx
// New baseline: <Screen> defaults to bg-background
// Existing per-screen `className="bg-white dark:bg-neutral-900"` overrides keep working
```

Optional: introduce `variant?: "background" | "surface"` prop. Default `"background"`. `"surface"` for screens that should sit at the same elevation as the chrome (e.g., a modal, a hero screen). Initially YAGNI — just default `bg-background` is enough for this task.

### 6. Safe-area gutter

The existing `Animated.View` wrapper in `(tabs)/_layout.tsx` already paints the safe area below the tab bar with `backgroundColor: tabBarBg`. After the token swap, this automatically becomes the surface color. No layout changes needed.

## Files changed

| File | Change |
|------|--------|
| `app/(main)/(tabs)/_layout.tsx` | Replace hardcoded hex with `useThemeColor` calls; add active/inactive tints; add hairline tab bar top border; set `headerStyle.backgroundColor`. |
| `components/TabIcon.tsx` | Wrap icon in vertical stack; add 3×24 pill indicator below; pill uses `bg-accent` when focused, transparent otherwise. |
| `components/TabsHeader.tsx` | Swap `bg-white dark:bg-neutral-900` → `bg-surface`; add `border-b border-border`; swap raw slate text classes → `text-muted` / `text-foreground`. |
| `components/screen.tsx` | Default `className` includes `bg-background`. Existing per-screen overrides still win via `twMerge`. |

No other files in scope.

## Verification

1. **Visual check (manual):** start dev build, in both light + dark:
   - Open Home tab — confirm header has white surface (light) / `#111a2e` (dark), hairline below, body sits in `#f1f5f9` (light) / `#0b1220` (dark) — cards float clearly.
   - Tap each tab — confirm active icon + label use accent color and the 3×24 pill renders below the label. Inactive tabs use muted color, pill transparent.
   - Status bar tint matches header surface (handled automatically).
2. **Token check:** `git grep -nE "#ffffff|#1c1c1e|bg-white|dark:bg-neutral-900" -- 'app/(main)/(tabs)/_layout.tsx' 'components/TabsHeader.tsx'` should return zero.
3. **Screen background sanity:** confirm individual screens that explicitly set their own bg color (e.g., `MaterialDetailsScreen.tsx:76` uses `bg-white dark:bg-neutral-900`) still render as before. The `Screen` default only kicks in when callers don't pass a bg class.

## Open tradeoffs (acknowledged)

- **No drop shadows on chrome edges.** Hairline borders are used instead. If the user wants a softer separation between header/body or tab-bar/body, swap the border for `--surface-shadow` / a custom shadow style. Borders chosen for sharpness and dark-mode legibility.
- **`--surface-tertiary` in dark mode currently equals `#334155`** — too light against `--surface` (`#111a2e`) for the recessed-body purpose. The design uses `--background` (`#0b1220`) for the dark recessed body instead, which inverts the layering relationship vs. light mode (light: surface > body lightness; dark: surface > body lightness still holds because `#111a2e` > `#0b1220`). Consistent visually; just worth noting.
- **Per-screen `bg-white dark:bg-neutral-900` overrides** in existing screens are not migrated as part of this task. They keep working because `twMerge` preserves caller classes. If desired later, those can swap to `bg-surface` for full token coherence.
- **No active-tab background pill** (e.g., a colored rounded-rect behind the icon). Just the indicator below. Less visual noise; can add if desired.

## Acceptance criteria

- `app/(main)/(tabs)/_layout.tsx` no longer references `#ffffff` or `#1c1c1e`. All chrome colors come from `useThemeColor`.
- Tab bar shows active/inactive tints driven by theme tokens.
- Tab bar has a hairline top border in light mode, hairline in dark mode (or none if visually noisy — to be confirmed in manual check).
- A 3×24px pill renders below the active tab's label in `accent` color.
- `components/TabsHeader.tsx` uses `bg-surface` + `border-b border-border` and `text-foreground` / `text-muted` for typography.
- `components/screen.tsx` default applies `bg-background`. Existing screens with explicit bg classes still render correctly.
- Manual visual verification passes in both light and dark mode.
