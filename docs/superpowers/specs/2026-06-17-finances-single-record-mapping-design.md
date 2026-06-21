# Finances API — single-record response mapping

**Date:** 2026-06-17
**Scope:** Data mapping only. No visual polish.

## Background

`GET /finances/` previously returned a DRF-paginated payload:

```ts
{ count, next, previous, results: FinancialRecord[] }
```

The screen iterated `data.results` and let the user pick which term's record to view via a `Select` driven by `useAcademicTerms()`.

The backend now returns a single `FinancialRecord` object (the current term, implied by context — the endpoint takes no term parameter). The pagination wrapper is gone.

Because the API no longer surfaces multiple terms in one call, the term selector has no functional purpose: there is no second record to switch to, and `/finances/` accepts no term argument that would let the selector drive a refetch.

## Goal

Align the mobile client to the new single-record response shape. Remove the dead term-selection UI. No layout, hierarchy, or styling changes — those remain queued under the earlier "Academic & Financial Records polish" deferral.

## Changes

### 1. `features/profile/profile.types.ts`

- Delete `FinancialRecordResponse` (no longer used).
- `FinancialRecord` remains the API response type.

### 2. `features/profile/profile.apis.ts`

- `getFinancialInformation` returns `FinancialRecord` instead of `FinancialRecordResponse`.

### 3. `features/profile/profile.hooks.ts`

- `useFinancialInformation` typing follows the API change automatically (no body changes required).
- `useAcademicTerms` remains exported. It is still used by `AcademicRecordsScreen` (separately scoped to the academic-records flow). Do not remove it.

### 4. `screens/profile/FinancialRecordsScreen.tsx`

- Remove `useAcademicTerms` import and call.
- Remove `selectedTermId` state and the `useEffect` that picks a default term.
- Remove the `selectedRecord` `useMemo` — consume `data` directly as the single `FinancialRecord`.
- Remove the `TermSelect` component and its render site.
- Remove the "No academic terms" empty state (it gated on `useAcademicTerms`; no longer relevant).
- Replace it with a single "No financial record" empty state shown when `!data` after a successful fetch.
- Show the term inline as a small subtitle near the top of the scroll content, sourced from `data.academicTerm.academicTermCode`.
- Update the skeleton: drop the term-select skeleton row (no selector to mirror); keep the three card skeletons.
- `isLoading` / `isError` / `isRefetching` gating simplifies — only `useFinancialInformation` participates.
- Drop the `AcademicTermItem` import (no longer used).

## Non-goals

- No balance hero, no grouped sections (Charges / Adjustments / Payments), no zero-balance collapse, no card-density changes. Those stay deferred and will be revisited as a separate polish spec.
- No changes to `AcademicRecordsScreen` or `useAcademicTerms` semantics.
- No backend changes.

## Risks

- **Existing screens consuming `FinancialRecordResponse`:** verified via grep — only `profile.apis.ts` and `FinancialRecordsScreen.tsx` reference it. Safe to remove.
- **Cached query data:** existing react-query caches keyed `["financial-information"]` will hold the old shape after upgrade. Acceptable — a single refetch (mount / pull-to-refresh) replaces it, and the cache is per-session in normal use. No migration needed.

## Testing

Manual: load Financial Records on a logged-in account, confirm the single record renders, term subtitle reads correctly, refresh works, error state shows on forced failure. No automated tests exist for this screen today and none are added in this pass.
