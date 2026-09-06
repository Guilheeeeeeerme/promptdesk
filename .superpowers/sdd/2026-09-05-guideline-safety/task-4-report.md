# Task 4 Report: UI, smoke, and integration verification

## UI changes

- Main CompaniesPage now displays active and latest-valid guideline versions and hashes.
- Guideline history displays pending, valid, invalid, and provider-error statuses with validation reasons.
- Pending versions and failed replacements are called out explicitly; invalid/provider-error replacements state that the prior active version remains in use.
- Guideline content remains rendered as plain text in the existing `pre` block.
- Support ChatPage was unchanged because it already displays the applied conversation guideline snapshot hash.

## Verification

- `apps/web`: `npm run build` passed.
- `apps/support`: `npm run build` passed.
- `git diff --check` passed.
- API/worker behavior was not changed by Task 4.

## Notes

The frontend has no configured test runner. Verification used the locked dependency installs, TypeScript compilation, Vite production builds, and the existing API/worker response contracts.
