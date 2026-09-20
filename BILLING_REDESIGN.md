# Billing workflow redesign

Finance > Billing now uses Choose, Check totals and Create invoices. Routine creation uses saved periods, active eligible clients and existing funded-day calculation services. Configuration lives in Billing settings; the former console remains available through Advanced billing. Previous invoices starts collapsed and offers search, month, client, payer, status and pagination.

Manual entered totals include VAT. They are represented as one service for the period; agreed calculations retain their existing quantity and rate. A difference of at least the greater of GBP 10 and 5% requires a reason, as does a total without an agreed baseline. Audit records capture the original calculated amount, final amount, actor, timestamp and reason.

The prepare API requires billing review for previews and both billing edit and approval for creation. It revalidates a preview fingerprint, binds an idempotency key to the request payload, and uses the existing calculation, approval, document and transactional invoice-generation services. Existing invoices require explicit replacement confirmation. A generation-time check under the invoice numbering lock rejects a competing replacement. Previous PDFs remain unchanged and available; successfully replaced invoices become earlier versions.

New invoice PDFs use Client and From-To / Service / QTY / Rate / NET / TOTAL, retaining VAT where applicable. Funded-day summary wording is removed. PO appears under the client and as Your Ref below the invoice number. Stored historical PDFs are never rewritten.

## Validation

- 485 tests passed, including the disposable MariaDB integration suite.
- TypeScript and targeted ESLint checks passed.
- Synthetic HTTP checks exercised permission denial, replacement confirmation, concurrent submissions, idempotent retry, changed-payload rejection, audit values, zero rejection, optional funded days and archive filters. Historical PDF hashes remained unchanged.
- Browser checks covered automatic totals, manual amendments and reasons, back/forward preservation, confirmation, creation of all eight selected synthetic clients, ZIP preparation, collapsed history, desktop, tablet (820px) and phone (390px) layouts.
- A generated invoice PDF was rendered and visually inspected.

## Deployment

No schema migration or dependency changes are required for this redesign. Deploy the application from main normally. New presentation applies to newly generated invoices; regenerate deliberately when a replacement is needed. No production client or invoice data was used or changed during validation.
