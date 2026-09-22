# V1.8.1 — simple staff invitations and existing PIN access

Previous version: V1.8.0. New version: V1.8.1.

In People → Staff, edit an employee and use Staff app access. Choose an access level with Staff Portal enabled and click Create invite link. The employee must already have a saved clocking PIN. This creates/links their user identity without asking for a new management password, enables their Staff Area, and opens their personal link and QR code. The link and downloadable QR remain available when reopening the profile.

Send the personal link or QR to the employee. It opens “Welcome, [first name]” and asks only for their existing clocking PIN. They can install STARS Staff before signing in. The personalised manifest preserves this entry point for installation. The random link identifies the employee; it is not an authenticated session and grants no HR access without the PIN or an existing authenticated session. Existing 4–8 digit clocking PINs (including six digits) work unchanged. Separate V1.8.0 portal PINs are no longer used. Management passwords and clocking credentials are not changed by this revision.

Staff portal now contains Access and Requests only. The duplicate entries have been removed from People. Manager reset/disable/session/passkey controls remain in Access. Legacy single-use activation links remain supported, but verify the existing clocking PIN rather than creating another one.

PWA investigation: the live HTTPS entry, scoped manifest, icons and worker returned successfully. The original installation banner was inside the signed-in view; it is now available on the login/welcome screen. Worker failures are surfaced instead of silently ignored. Android guidance distinguishes Chrome's Install option from Create shortcut. Actual Android WebAPK installation cannot be verified from this desktop environment.

Deployment: apply `20260922022000_staff_personal_links` with `prisma migrate deploy`, then generate the client and deploy. It adds one optional unique link column; existing staff and HR records are preserved. No new production data was entered during verification.

Verification: named welcome/PIN/install controls checked in the browser; HTTP tests cover profile setup, unchanged management passwords, stable links, personalised manifests, six-digit existing PIN login, revoked PIN rejection, lockout, resets, passkeys, authorisation and private documents. Navigation tests cover the moved menu items. Development-only CSP permits Next's development runtime; production CSP remains unchanged.
