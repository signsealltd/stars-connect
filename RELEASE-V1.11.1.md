# STARS Connect V1.11.1

Previous version: V1.11.0. New version: V1.11.1.

Refines the shared vehicle-check mobile interface used by management, STARS Staff and private driver links. No database migration or changes to check submission, permissions, daily rollover or amendment history.

- Compact app header, readable UK dates, saved/offline indicators and purple step progress.
- Mileage starts empty when the stored reading is zero, accepts digits, normalises leading zeroes and selects existing text on focus. Previous-mileage validation remains in place.
- Camera buttons replace the native file picker presentation. Vehicle photographs have previews, retake and remove controls.
- Consistent checklist cards and defect dialog, aligned bottom actions with safe-area spacing, structured review rows, summary tiles and result panels.
- Submission remains unavailable until the declaration and required details are complete, with visible and accessible guidance.

Validation: TypeScript and ESLint completed with no errors (existing lint warnings remain). Vitest: 585 passed, 21 opt-in database tests skipped. Mobile browser checks cover all eight steps at 360px, 390px and 412px, mileage entry, photographs, defects, declaration gating and horizontal overflow. Screenshots of the first step, checklist sections, defect dialog and review were captured and visually inspected. Production build verified.
