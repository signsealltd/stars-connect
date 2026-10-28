# Extra-day register attendance

Deploy with `npx prisma migrate deploy` and regenerate Prisma before starting the app.
The new StudentAttendance.extraDay flag defaults to false; historical attendance is not inferred to be extra.

In the register choose Add client for an extra day, then Add and mark present. This records arrival and a billable extra-day flag, without changing the regular schedule. Offline entries join billing after sync.

New or recalculated billing runs include one separate day per flagged PRESENT, LATE or OFFSITE record in the selected period, using the agreed funded DAY rate effective on that date and the usual payer. Missing or ambiguous billing configuration blocks calculation. The billing wizard includes these charges in its review totals; PDFs show a dated Extra day attendance line. Normal funded allocation and holiday deductions remain separate. Exclusions survive run revisions. Recalculation replaces generated charges rather than appending duplicates.

Issued or locked invoices are not changed when attendance is recorded later. Create a reviewed revision for that period to include late extra days; paid-invoice replacement restrictions still apply. Custom invoices remain manual.
