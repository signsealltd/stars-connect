# STARS Connect V1.6.0

Previous production version: V1.5.1. New version: V1.6.0. This is one feature release covering the billing refinements and new staff planning workflow; no intermediate patch was released.

## Billing and navigation

- Manual billing shows every client before dates are applied, across billing groups. Users still select clients explicitly. Applying dates retains manual selections, calculates amounts and reports setup/date issues without hiding clients.
- Missing LBE PO references are advisory. Invoices can be issued, reissued and corrected without a PO. Supplied references still appear on invoices.
- Confirmed repeat billing supports exact-period replacements and additional overlapping interim invoices. Historical documents remain intact and retry idempotency is retained.
- Billing setup is a searchable client/payer/reference list. Add New and Edit open a responsive modal, with client search and an audited reason for edits. The list shows PO/REF instead of VAT; VAT settings remain in the form.
- Finance includes Billing setup, Billing periods and Payments Checklist. Billing periods opens the existing editor directly. Payments Checklist is a Coming soon placeholder only.
- Development is removed from navigation. Calendar is a direct link and Health & Safety / RAMS is under Safety & Compliance. Existing capability controls still apply.

## Staff planning

- Staff profiles include weekly working days and times, effective from today or a future date. Schedule changes preserve previous dated patterns. New staff are saved before configuring working days.
- Calendar expected staffing is projected for the displayed month, beyond the former 90-day materialisation window, in Europe/London time. Employment dates and stored shifts are respected.
- Managers can record holidays and sickness from Staff or Calendar using shared records. Dates are inclusive. Absences appear on the calendar and remove planned staffing for those days. Cancelling a record retains its audit history and restores the regular plan.
- Management notes are stored separately from calendar summaries. These operations do not change actual clock events, payroll calculations or invoices.
- The implementation uses existing working-pattern and schedule-exception tables, providing shared history for later HR expansion. No schema migration is required.

## Verification

- 509 automated tests passed, including MariaDB integration tests.
- Local HTTP checks covered all-client manual billing, missing PO, overlapping interim invoices, exact-period replacement and idempotent retries.
- Staff HTTP checks covered weekly scheduling, effective-date replacement and history, holiday, sickness, cancellation, future-month projection and unchanged clock-event counts.
- Browser checks covered billing search, responsive modal layout, manual client visibility, Finance links, Payments Checklist, staff working days and absence forms.
- TypeScript and the production build were checked before release. All test data was synthetic in the local validation database.
