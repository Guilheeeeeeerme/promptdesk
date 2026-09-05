# Task 5 Report: Support account menu

## Changes

- Replaced the Support top-bar logout button with an always-visible username button.
- Added a click-open account menu showing the signed-in email and `Log out`.
- Added menu accessibility attributes and Escape handling with focus restored to the account button.
- Kept the existing `useAuth().logout` callback unchanged, preserving token/session invalidation and the Main SSO return handoff.
- Confirmed Support remains chat-only; no API or Main files were changed.

## Verification

- `npm run build` from an isolated Support dependency directory: passed.
- `git diff --check`: passed.

## Commit

- `feat: align support account menu with main app`
