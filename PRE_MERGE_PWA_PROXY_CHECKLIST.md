# STARS Connect pre-merge PWA and proxy checklist

Use synthetic accounts and records only. Screenshots and logs must not contain
secrets, tokens, personal data, signatures or clocking photographs.

| Check | Steps | Expected result | Pass/fail | Evidence |
|---|---|---|---|---|
| Proxy login | Open the public HTTPS login page and sign in with a synthetic account. | Dashboard opens; secure session cookie is issued. | ___ | Redacted timestamp and HTTP status. |
| Failed-login throttling | Submit five incorrect synthetic passwords within one minute, then a sixth. | The sixth attempt returns 429 without affecting a different client IP. | ___ | Redacted Network statuses. |
| Client IP | Sign in once, then inspect the redacted audit entry. | It records the actual client IP, not the proxy address or a spoofed first header. | ___ | Redacted last octet and timestamp. |
| Idle expiry | Sign in, leave the session unused for more than 30 minutes, then open a protected page. | The user is required to sign in again. | ___ | Start/end timestamps. |
| Disabled user | Sign in as a synthetic user, disable that user from another administrator session, then refresh. | Existing session loses access immediately. | ___ | Redacted account and status. |
| Samsung PWA launch | Fully close and reopen the installed PWA on each tablet. | Standalone kiosk shell opens without browser chrome or errors. | ___ | Device asset code and timestamp. |
| Service worker | Inspect Chrome remote debugging Application → Service Workers. | `/sw.js` is activated and controls kiosk routes. | ___ | Redacted status screenshot. |
| PWA update | Deploy only to a disposable test environment, change the version, reopen and refresh. | New worker activates predictably without losing legitimate queued data. | ___ | Old/new synthetic version. |
| Offline shell | Load kiosk once online, enable airplane mode, then relaunch. | Offline shell opens and clearly reports offline state. | ___ | Device asset code and timestamp. |
| Front camera | With synthetic staff and camera-required clocking, enter the PIN and allow camera. | Front camera opens; clocking succeeds only after capture. | ___ | No photograph; record only result/time. |
| PDF download | Download a synthetic protected PDF as an authorized user. | Download succeeds; unauthorized user receives 403/redirect. | ___ | Filename and statuses only. |
| CSV download | Download a synthetic protected CSV. | Correct file downloads without CSP errors. | ___ | Filename and HTTP status. |
| Backup download | Create and download a disposable test backup as Administrator. | Authorized download succeeds; non-admin access is denied. | ___ | Size/status only; never attach backup. |
| Wrong-origin CSRF | From an isolated test origin, submit a cookie-authenticated mutation. | Request is rejected with 403. | ___ | Origins and status, no body data. |
| Same-origin mutation | Repeat the synthetic mutation from the application origin. | Request succeeds when role/capability permits. | ___ | Route and status. |
| Visitor contact | Test Manager contact allow and explicit deny overrides. | Phone/email appear only with `visitor-contact.view`. | ___ | Synthetic fields only. |
| Visitor signature | Test Manager default, Manager deny, Reception default and Reception allow. | Manager default/Reception allow succeed; Manager deny/Reception default return 403. | ___ | Role, override and status only. |
| HSTS/subdomains | Check HTTPS for every affected subdomain and inspect the response header. | All affected names support HTTPS before acknowledging `includeSubDomains`. | ___ | Hostnames and header only. |
