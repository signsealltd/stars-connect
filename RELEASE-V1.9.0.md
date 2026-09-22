# V1.9.0 — Calendar participants and readable staff changes

Previous version: V1.8.5. New version: V1.9.0.

Calendar → Add activity now offers separate searchable staff and client selections. Either or both can be selected. Staff assignments and planned client attendees are saved atomically with the activity. Unavailable staff and overlapping activity assignments return readable errors inside the modal. Existing assignment permissions continue to apply.

Calendar activities enter Planning so assigned staff can see them in their personal Staff Area schedule immediately. Only the selected staff member's assignments are loaded for that schedule. They display as Planned; external calendar downloads use tentative status. Planning does not mark client attendance, change payroll or create invoices.

Staff request reviews now show labelled Before and After values instead of JSON. Historic nested profile fields are aligned with the newer flat format. Addresses and emergency contacts retain line breaks; notification preferences display Yes/No. Request event labels are also readable.

Validation: 560 tests passed in the suite (18 database integration tests skipped), plus the personal-schedule regression passed. All seven targeted assignment, schedule and formatting tests passed. Targeted lint passed. No database migration is required.
Production build and final TypeScript validation passed.
