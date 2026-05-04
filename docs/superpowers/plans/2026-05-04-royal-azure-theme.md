# Royal Azure Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Royal Azure monochromatic blue theme to the Classedge mobile app by overriding HeroUI Native's color tokens and migrating all hardcoded `blue-*` Tailwind classes to semantic tokens.

**Architecture:** Pure token swap. No component logic changes. Override HeroUI's documented variables in `global.css` using the same `@layer theme { :root { @variant light { } @variant dark { } } }` structure HeroUI itself uses, then replace 22 hardcoded `text-blue-*` / `bg-blue-*` / `border-blue-*` usages with `text-accent` / `bg-accent` / `bg-accent-soft` / `border-accent` so the theme actually controls them.

**Tech Stack:** HeroUI Native 1.0.0, Uniwind (Tailwind for React Native), Tailwind v4, Expo SDK 54, React Native 0.81.

**Spec:** `docs/superpowers/specs/2026-05-04-royal-azure-theme-design.md`

---

## File Structure

**Modified:**
- `global.css` — append `@layer theme` block with light + dark token overrides
- 14 component files — swap raw `blue-*` classes for semantic tokens (full list in Task 2)

**Not modified:**
- Any HeroUI component imports
- `providers/HeroUIProvider.tsx` (already correct)
- `babel.config.js`, `metro.config.js`, `tailwind.config.*` (no Tailwind config file exists; v4 reads from `global.css`)

---

## Task 1: Apply Royal Azure tokens to global.css

**Files:**
- Modify: `global.css`

- [ ] **Step 1: Append the theme override block to `global.css`**

Open `global.css`. The current file ends at line 18 (the closing `}` of the `@theme` font block). Append a blank line and the following block at the bottom of the file:

```css

@layer theme {
  :root {
    @variant light {
      /* Royal Azure — Light */
      --background: #ffffff;
      --foreground: #0f172a;
      --muted: #64748b;

      --surface: #ffffff;
      --surface-foreground: #0f172a;

      --surface-secondary: #f8fafc;
      --surface-secondary-foreground: #0f172a;

      --surface-tertiary: #f1f5f9;
      --surface-tertiary-foreground: #0f172a;

      --overlay: #ffffff;
      --overlay-foreground: #0f172a;

      --default: #f1f5f9;
      --default-foreground: #0f172a;

      --accent: #2563eb;
      --accent-foreground: #ffffff;

      --field-background: #ffffff;
      --field-foreground: #0f172a;
      --field-placeholder: #94a3b8;
      --field-border: #e2e8f0;

      --success: #15803d;
      --success-foreground: #ffffff;

      --warning: #b45309;
      --warning-foreground: #ffffff;

      --danger: #b91c1c;
      --danger-foreground: #ffffff;

      --segment: #ffffff;
      --segment-foreground: #0f172a;

      --border: #e2e8f0;
      --separator: #cbd5e1;
      --focus: var(--accent);
      --link: #2563eb;
    }

    @variant dark {
      /* Royal Azure — Dark */
      --background: #0b1220;
      --foreground: #f1f5f9;
      --muted: #94a3b8;

      --surface: #111a2e;
      --surface-foreground: #f1f5f9;

      --surface-secondary: #1e293b;
      --surface-secondary-foreground: #f1f5f9;

      --surface-tertiary: #334155;
      --surface-tertiary-foreground: #f1f5f9;

      --overlay: #1e293b;
      --overlay-foreground: #f1f5f9;

      --default: #1e293b;
      --default-foreground: #f1f5f9;

      --accent: #3b82f6;
      --accent-foreground: #ffffff;

      --field-background: #1e293b;
      --field-foreground: #f1f5f9;
      --field-placeholder: #64748b;
      --field-border: #334155;

      --success: #22c55e;
      --success-foreground: #052e16;

      --warning: #f59e0b;
      --warning-foreground: #1c1917;

      --danger: #ef4444;
      --danger-foreground: #ffffff;

      --segment: #334155;
      --segment-foreground: #f1f5f9;

      --border: #1e293b;
      --separator: #334155;
      --focus: var(--accent);
      --link: #60a5fa;
    }
  }
}
```

- [ ] **Step 2: Verify file contents**

Read `global.css`. Expected: file ends with the `@layer theme { ... }` block above. The previous `@import` and `@theme` font block must remain intact above it.

- [ ] **Step 3: Run dev build and visually verify both modes**

Run the app on a simulator:

```bash
npm run ios
# or: npm run android
```

Open the **Profile** screen. Expected:
- **Light mode:** Card surfaces are pure white, separators are slate-200, the Submit / primary buttons render in `#2563eb` (Royal Azure blue).
- **Dark mode:** Background is deep blue-tinted slate (`#0b1220`), card surfaces step subtly to `#111a2e`, primary buttons render in `#3b82f6`.

Tap the new **Dark Mode** row to flip themes. Both modes should render cleanly with no flash of unstyled tokens.

> **Note:** Profile-row icons will still appear bright blue (`#3b82f6` from `text-blue-500`) at this point — they are migrated in Task 2.

- [ ] **Step 4: Commit**

```bash
git add global.css
git commit -m "$(cat <<'EOF'
feat(theme): apply Royal Azure tokens to global.css

Override HeroUI Native's accent, surface, and chrome tokens with a
monochromatic blue palette. Status colors use muted variants to keep
the palette feeling unified. See spec for the full rationale.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrate hardcoded blue classes to semantic tokens

**Files:** 14 files across `app/`, `components/`, `features/`, `screens/`. Each step is one file (or one logical pair of edits in the same file).

**Why these mappings:**
- `text-blue-*` (foreground accents) → `text-accent`
- `bg-blue-500/600` (solid CTA / dot) → `bg-accent`
- `bg-blue-50/100/950 + dark variants` (tinted backgrounds) → `bg-accent-soft` (HeroUI auto-derives this via `color-mix(in oklab, var(--accent) 15%, transparent)`)
- `border-blue-500` → `border-accent`

- [ ] **Step 1: `screens/profile/ProfileScreen.tsx:72`**

Change:
```tsx
<Icon name={name} size={28} className="text-blue-500" />
```
To:
```tsx
<Icon name={name} size={28} className="text-accent" />
```

- [ ] **Step 2: `features/auth/components/LogoutButton.tsx:52`**

Change:
```tsx
<Icon name={"SignOut"} size={28} className="text-blue-500" />
```
To:
```tsx
<Icon name={"SignOut"} size={28} className="text-accent" />
```

- [ ] **Step 3: `features/auth/components/ResyncButton.tsx:57`**

Change line 57 (inside an `<Icon name="ArrowsClockwiseIcon" size={28}` element):
```tsx
className="text-blue-500"
```
To:
```tsx
className="text-accent"
```

- [ ] **Step 4: `features/profile/components/ThemeToggleButton.tsx:21`**

Change line 21 (inside the `<Icon>` element):
```tsx
className="text-blue-500"
```
To:
```tsx
className="text-accent"
```

- [ ] **Step 5: `features/classroom/components/StudentScoringList.tsx:182`**

Change:
```tsx
<AppText weight="semibold" className="text-blue-500 text-base">
```
To:
```tsx
<AppText weight="semibold" className="text-accent text-base">
```

- [ ] **Step 6: `components/EmptyState.tsx` (lines 17 + 21)**

Two edits in one file.

Line 17 — change:
```tsx
<View className="p-4 sm:p-5 md:p-6 rounded-full bg-blue-50 dark:bg-blue-950">
```
To:
```tsx
<View className="p-4 sm:p-5 md:p-6 rounded-full bg-accent-soft">
```

Line 21 — change:
```tsx
className="text-blue-500 dark:text-blue-400"
```
To:
```tsx
className="text-accent"
```

- [ ] **Step 7: `components/NoDataFallback.tsx` (lines 23, 27, 45)**

Three edits in one file.

Line 23 — change:
```tsx
<View className="p-4 sm:p-5 md:p-6 rounded-full bg-blue-50 dark:bg-blue-950">
```
To:
```tsx
<View className="p-4 sm:p-5 md:p-6 rounded-full bg-accent-soft">
```

Line 27 — change:
```tsx
className="text-blue-500 dark:text-blue-400"
```
To:
```tsx
className="text-accent"
```

Line 45 — change:
```tsx
className="bg-blue-600 dark:bg-blue-500 rounded-lg px-6 sm:px-8 py-2.5 sm:py-3 items-center"
```
To:
```tsx
className="bg-accent rounded-lg px-6 sm:px-8 py-2.5 sm:py-3 items-center"
```

- [ ] **Step 8: `features/notifications/components/NotificationList.tsx` (lines 88 + 111)**

Two edits in one file.

Line 88 — change the unread row tint (note: this is inside a template literal):
```tsx
className={`flex-row items-start p-4 ${isReadBool ? "bg-transparent" : "bg-blue-400/15 dark:bg-blue-400/10"}`}
```
To:
```tsx
className={`flex-row items-start p-4 ${isReadBool ? "bg-transparent" : "bg-accent-soft"}`}
```

Line 111 — change the unread dot:
```tsx
<View className="w-2.5 h-2.5 rounded-full bg-blue-600 self-center ml-2" />
```
To:
```tsx
<View className="w-2.5 h-2.5 rounded-full bg-accent self-center ml-2" />
```

> **Leave `text-blue-100` on line 104 unchanged** — it is an intentional fixed light-blue label color for the unread timestamp against the tinted row, no `dark:` variant. Re-evaluate after theme is applied if it reads poorly.

- [ ] **Step 9: `features/announcements/components/AnnouncementList.tsx` (lines 129 + 137)**

Two identical edits. Both lines 129 and 137 currently read:
```tsx
className="text-blue-600 dark:text-blue-400"
```
Change both to:
```tsx
className="text-accent"
```

- [ ] **Step 10: `features/calendar/components/EventDetailModal.tsx` (lines 125, 153, 177, 200)**

Four identical edits. Each line currently reads:
```tsx
className="text-blue-600 dark:text-blue-400"
```
Change all four to:
```tsx
className="text-accent"
```

- [ ] **Step 11: `screens/main/courses/course/material/MaterialDetailsScreen.tsx` (lines 456 + 461)**

Two edits in one file.

Line 456 — change:
```tsx
<View className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 items-center justify-center shrink-0">
```
To:
```tsx
<View className="w-10 h-10 rounded-lg bg-accent-soft items-center justify-center shrink-0">
```

Line 461 — change:
```tsx
className="flex-1 text-blue-600 dark:text-blue-400 text-sm"
```
To:
```tsx
className="flex-1 text-accent text-sm"
```

- [ ] **Step 12: `features/courses/components/CourseDetails.tsx:132`**

Change:
```tsx
<View className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 items-center justify-center mb-3">
```
To:
```tsx
<View className="w-9 h-9 rounded-full bg-accent-soft items-center justify-center mb-3">
```

- [ ] **Step 13: `features/profile/components/HeaderComponent.tsx:19`**

Change:
```tsx
<View className="p-1 border-3 border-blue-500 rounded-full">
```
To:
```tsx
<View className="p-1 border-3 border-accent rounded-full">
```

- [ ] **Step 14: Run completeness check**

Run from the project root:

```bash
git grep -nE "(text|bg|border)-blue-(50|100|200|300|400|500|600|700|800|900|950)" -- 'app/' 'components/' 'features/' 'screens/'
```

Expected output: **only** the line `features/notifications/components/NotificationList.tsx:104:        className={\`text-[10px] mt-1 uppercase font-medium ${isReadBool ? "text-slate-400 dark:text-slate-500" : "text-blue-100"}\`}` (the intentional fixed unread-timestamp color from Step 8's note).

Anything else means a usage was missed — go back and fix.

- [ ] **Step 15: Commit**

```bash
git add app/ components/ features/ screens/
git commit -m "$(cat <<'EOF'
refactor(theme): replace hardcoded blue classes with semantic tokens

Migrate text-blue-*, bg-blue-*, and border-blue-* across 14 files to
the semantic accent / accent-soft tokens. The theme now drives all
icon, button, link, and tinted-background colors. One intentional
text-blue-100 in NotificationList retained per spec.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manual visual verification across both modes

**Files:** none (verification only)

- [ ] **Step 1: Build and launch the app**

```bash
npm run ios
# or: npm run android
```

Wait for the Metro bundler and the simulator to boot.

- [ ] **Step 2: Light-mode walkthrough**

Use the in-app **Dark Mode** toggle on the Profile screen to ensure light mode is active. Walk through these screens and confirm each visual checkpoint:

- **Profile (home of toggle):** Nav-row icons render in Royal Azure (`#2563eb`), separator lines visible, "Force Resync" + Logout buttons inherit theme.
- **Login screen:** Microsoft button + form fields use the new accent for focus/active states.
- **Courses tab → a course → Material:** Header icon background is a soft accent tint (not generic light blue), link text is accent.
- **Notifications tab:** Unread rows show soft accent tint background, unread dot is solid accent.
- **Announcements:** Accent-colored "View all" / "Read more" links use the new blue.
- **Calendar → tap an event:** Modal links and header use accent.
- **Empty states:** Icon bubbles use soft accent, icon glyphs use accent.

- [ ] **Step 3: Dark-mode walkthrough**

Tap the **Dark Mode** toggle and repeat Step 2 in dark mode. Specifically check:

- Background reads as deep blue-tinted slate (`#0b1220`), not pure black.
- Card surface elevation is subtle — surface (`#111a2e`) → surface-secondary (`#1e293b`) should be just barely distinguishable.
- Primary buttons brighten to `#3b82f6` (more vivid for dark contrast).
- Status pills (success / warning / danger) still read clearly — muted variants from the spec are darker than HeroUI defaults; if any state pill reads as too quiet, note for follow-up.

- [ ] **Step 4: Destructive-action sanity check**

Open the **Logout** dialog from Profile → "Yes, log me out" button uses the muted danger color. Confirm it still reads as destructive enough; if not, the `--danger` token can be reverted to HeroUI's vibrant default in a follow-up commit (see spec § Open tradeoffs).

> **Do not actually log out** — just verify visual treatment, then cancel.

- [ ] **Step 5: Note any visual regressions**

If anything looks broken (contrast issues, illegible text, missed components), capture the screen and file as a follow-up — do not silently fix. The plan's job is to land the spec faithfully; deviations get their own decisions.

- [ ] **Step 6: No commit needed for verification**

This task produces no code changes. If verification surfaced fixes, those go in a separate follow-up commit with a clear message explaining the deviation.

---

## Done

After Task 3, the spec's acceptance criteria are met:
- [x] `global.css` contains the full token override block for both light and dark.
- [x] All 22 hardcoded blue usages are replaced with semantic tokens.
- [x] Manual visual check passes in both modes.
- [x] `git grep -E "(text|bg|border)-blue-[0-9]"` returns only the one intentional line in `NotificationList.tsx:104`.
