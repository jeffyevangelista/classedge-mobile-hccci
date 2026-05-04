# Royal Azure — Theme & Color Scheme Design

**Status:** approved
**Date:** 2026-05-04
**Scope:** Replace HeroUI Native default theme tokens with a monochromatic blue-ish palette tuned for an educational app, while keeping HeroUI's compound-component API and Uniwind/Tailwind structure unchanged.

---

## Goals

- Give the app a distinct, modern identity that signals "learning tool" rather than generic blue chrome.
- Keep one tight blue family across surfaces, accent, and interactive states (monochromatic feel).
- Preserve HeroUI Native's token-based theming so component variants (`accent-soft`, `border-secondary`, hover states) continue to derive automatically.
- Replace hardcoded `text-blue-500` icon classes throughout the app with the semantic `text-accent` token so the theme actually controls icon color.

## Non-goals

- Restyling individual components (Button, Card, etc.) — variants stay HeroUI default.
- Adding a manual theme toggle (already implemented via `ThemeToggleButton`).
- Updating brand assets (logo, splash, app icons).
- Internationalization, typography changes, or layout adjustments.

## Constraints (from user decisions)

1. **Monochromatic blue family.** The user explicitly chose a single-hue chrome.
2. **Royal Azure palette** picked from three options (Cobalt / Royal Azure / Sky).
3. **Muted status colors.** The user accepted v1 over the HeroUI-principle-aligned v2. Status colors are darker, lower-saturation than HeroUI defaults to maintain monochromatic harmony. *Tradeoff acknowledged: a muted danger button is less alarming for destructive actions like Logout.*
4. **Hex color values.** Tailwind v4 accepts any CSS color; the user chose hex for readability over oklch consistency.

## Palette — Royal Azure (v1)

### Light tokens

| Token | Value | Notes |
|-------|-------|-------|
| `--background` | `#f1f5f9` | Slate-100 — recessed body, mirrors dark mode's `#0b1220` step below `--surface` |
| `--foreground` | `#0f172a` | slate-900 |
| `--muted` | `#64748b` | slate-500 |
| `--surface` | `#ffffff` | Same as background |
| `--surface-secondary` | `#f8fafc` | slate-50 |
| `--surface-tertiary` | `#f1f5f9` | slate-100 |
| `--overlay` | `#ffffff` | Dialogs / popovers |
| `--overlay-foreground` | `#0f172a` | |
| `--default` | `#f1f5f9` | slate-100 |
| `--default-foreground` | `#0f172a` | |
| `--accent` ★ | `#2563eb` | blue-600 — brand primary |
| `--accent-foreground` | `#ffffff` | |
| `--field-background` | `#ffffff` | |
| `--field-foreground` | `#0f172a` | |
| `--field-placeholder` | `#94a3b8` | slate-400 |
| `--field-border` | `#e2e8f0` | slate-200 |
| `--success` | `#15803d` | green-700 (muted) |
| `--success-foreground` | `#ffffff` | |
| `--warning` | `#b45309` | amber-700 (muted) |
| `--warning-foreground` | `#ffffff` | |
| `--danger` | `#b91c1c` | red-700 (muted) |
| `--danger-foreground` | `#ffffff` | |
| `--border` | `#e2e8f0` | slate-200 |
| `--separator` | `#cbd5e1` | slate-300 |
| `--focus` | `var(--accent)` | |
| `--link` | `#2563eb` | blue-600 |
| `--segment` | `#ffffff` | |
| `--segment-foreground` | `#0f172a` | |

### Dark tokens

| Token | Value | Notes |
|-------|-------|-------|
| `--background` | `#0b1220` | Deep blue-tinted slate |
| `--foreground` | `#f1f5f9` | slate-100 |
| `--muted` | `#94a3b8` | slate-400 |
| `--surface` | `#111a2e` | Slightly elevated |
| `--surface-secondary` | `#1e293b` | slate-800 |
| `--surface-tertiary` | `#334155` | slate-700 |
| `--overlay` | `#1e293b` | |
| `--overlay-foreground` | `#f1f5f9` | |
| `--default` | `#1e293b` | |
| `--default-foreground` | `#f1f5f9` | |
| `--accent` ★ | `#3b82f6` | blue-500 — brighter for dark contrast |
| `--accent-foreground` | `#ffffff` | |
| `--field-background` | `#1e293b` | |
| `--field-foreground` | `#f1f5f9` | |
| `--field-placeholder` | `#64748b` | |
| `--field-border` | `#334155` | |
| `--success` | `#22c55e` | green-500 (lifted for dark) |
| `--success-foreground` | `#052e16` | |
| `--warning` | `#f59e0b` | amber-500 |
| `--warning-foreground` | `#1c1917` | |
| `--danger` | `#ef4444` | red-500 |
| `--danger-foreground` | `#ffffff` | |
| `--border` | `#1e293b` | |
| `--separator` | `#334155` | |
| `--focus` | `var(--accent)` | |
| `--link` | `#60a5fa` | blue-400 |
| `--segment` | `#334155` | |
| `--segment-foreground` | `#f1f5f9` | |

★ = primary brand color

## Code changes

### 1. `global.css` — token overrides

Append a `:root` block with `@variant light` and `@variant dark` overrides at the **bottom** of `global.css` (after the existing `@theme` font block). It must come after `@import "heroui-native/styles"` so the cascade favors our overrides.

Structure mirrors `node_modules/heroui-native/src/styles/variables.css` — same variable names, same `@layer theme` wrapping, just different values.

### 2. Hardcoded blue color replacements

These files use raw Tailwind blue classes. Replace each with the corresponding semantic token so the theme controls them. HeroUI auto-derives `accent-soft` via `color-mix(in oklab, var(--accent) 15%, transparent)`, so tinted backgrounds map to `bg-accent-soft`.

**Foreground / accent text and solid accent backgrounds → `text-accent` / `bg-accent`:**

| File | Line | Current | Replace with |
|------|-----:|---------|--------------|
| `screens/profile/ProfileScreen.tsx` | 72 | `text-blue-500` | `text-accent` |
| `features/auth/components/LogoutButton.tsx` | 52 | `text-blue-500` | `text-accent` |
| `features/auth/components/ResyncButton.tsx` | 57 | `text-blue-500` | `text-accent` |
| `features/profile/components/ThemeToggleButton.tsx` | 21 | `text-blue-500` | `text-accent` |
| `features/classroom/components/StudentScoringList.tsx` | 182 | `text-blue-500` | `text-accent` |
| `components/EmptyState.tsx` | 21 | `text-blue-500 dark:text-blue-400` | `text-accent` |
| `components/NoDataFallback.tsx` | 27 | `text-blue-500 dark:text-blue-400` | `text-accent` |
| `components/NoDataFallback.tsx` | 45 | `bg-blue-600 dark:bg-blue-500` | `bg-accent` |
| `features/notifications/components/NotificationList.tsx` | 111 | `bg-blue-600` (unread dot) | `bg-accent` |
| `features/announcements/components/AnnouncementList.tsx` | 129 | `text-blue-600 dark:text-blue-400` | `text-accent` |
| `features/announcements/components/AnnouncementList.tsx` | 137 | `text-blue-600 dark:text-blue-400` | `text-accent` |
| `features/calendar/components/EventDetailModal.tsx` | 125 | `text-blue-600 dark:text-blue-400` | `text-accent` |
| `features/calendar/components/EventDetailModal.tsx` | 153 | `text-blue-600 dark:text-blue-400` | `text-accent` |
| `features/calendar/components/EventDetailModal.tsx` | 177 | `text-blue-600 dark:text-blue-400` | `text-accent` |
| `features/calendar/components/EventDetailModal.tsx` | 200 | `text-blue-600 dark:text-blue-400` | `text-accent` |
| `screens/main/courses/course/material/MaterialDetailsScreen.tsx` | 461 | `text-blue-600 dark:text-blue-400` | `text-accent` |

**Tinted backgrounds and accent borders → `bg-accent-soft` / `border-accent`:**

| File | Line | Current | Replace with |
|------|-----:|---------|--------------|
| `components/EmptyState.tsx` | 17 | `bg-blue-50 dark:bg-blue-950` | `bg-accent-soft` |
| `components/NoDataFallback.tsx` | 23 | `bg-blue-50 dark:bg-blue-950` | `bg-accent-soft` |
| `features/notifications/components/NotificationList.tsx` | 88 | `bg-blue-400/15 dark:bg-blue-400/10` (unread row) | `bg-accent-soft` |
| `screens/main/courses/course/material/MaterialDetailsScreen.tsx` | 456 | `bg-blue-100 dark:bg-blue-900/50` | `bg-accent-soft` |
| `features/courses/components/CourseDetails.tsx` | 132 | `bg-blue-100 dark:bg-blue-900` | `bg-accent-soft` |
| `features/profile/components/HeaderComponent.tsx` | 19 | `border-blue-500` (avatar ring) | `border-accent` |

**Note on `text-blue-100`** — `features/notifications/components/NotificationList.tsx:104` has a `text-blue-100` for the unread timestamp label (no `dark:` variant). It's intentionally a fixed light-blue against the tinted unread row background. Leaving as-is; can revisit if it reads poorly post-theme-swap.

Already correctly using semantic tokens (no change needed):
- `features/auth/components/MSAuthButton.tsx`, `LoginForm.tsx`, `OTPVerificationForm.tsx`, `ForgotPasswordForm.tsx`, `PasswordResetForm.tsx` — use `useThemeColor`
- `features/sync/components/SyncBanner.tsx` — uses `useThemeColor`

## Files unchanged

- All HeroUI component imports stay the same.
- `providers/HeroUIProvider.tsx` — no change (already wires `useUniwind` correctly).
- `tailwind.config.*` — none exists; Tailwind v4 reads from `global.css`.
- `babel.config.js`, `metro.config.js` — no change.

## Verification

1. **Visual check (manual):** start dev build (`npm run ios` / `npm run android`), navigate Profile, Courses, Login screens in both light + dark. Check:
   - Icons in Profile rows use the new blue (not the old generic blue).
   - Submit / primary buttons use Royal Azure.
   - Logout dialog's "Yes, log out" button uses muted red — confirm it still reads as destructive enough.
   - Status pills in `SyncBanner` adopt new tokens automatically.
2. **Theme toggle:** tap the new Dark Mode row in Profile → both modes should flip cleanly with no leftover hardcoded colors.
3. **Dark backgrounds:** confirm card surfaces step subtly from background — no visible "banding" between surface tiers.

## Open tradeoffs (acknowledged)

- **Muted danger** (`#b91c1c` light / `#ef4444` dark): less aggressive than HeroUI default. If destructive flows feel under-emphasized in real use, swap `danger` back to HeroUI vibrant defaults — the rest of the palette is unaffected.
- **Hex vs oklch:** future HeroUI theme updates may shift baseline tokens in oklch; hex overrides are stable but won't drift with library updates.
- **No icon migration to ring/badge surfaces:** icons inside Profile rows use the same `text-accent` for every entry — no per-feature variation. If desired later, swap individual rows to `text-success`, `text-warning`, etc. for visual variety.

## Acceptance criteria

- `global.css` contains the full token override block for both light and dark.
- All 22 hardcoded blue usages in the tables above (16 accent + 6 soft/border) are replaced with semantic tokens.
- Manual visual check passes in both modes on at least one device build.
- `git grep -E "text-blue-[0-9]|bg-blue-[0-9]"` returns no results in `app/`, `components/`, `features/`, `screens/` after the change.
