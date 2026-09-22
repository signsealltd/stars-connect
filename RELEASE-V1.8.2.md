# V1.8.2 — staff grades and automatic access

Previous version: V1.8.1. New version: V1.8.2.

Staff profiles now offer exactly five job titles: Administrator, Assistant Manager, Manager, Team Leader and Support Worker. Saving a new grade assigns the matching access level and synchronises the linked user account. Assistant Manager and Manager are separate configurable access-level records, initially based on the existing Manager permissions. Support Worker uses the existing Care Assistant base role internally.

The staff-profile access/invitation block has been removed. Create/copy personal links, display/download QR codes and manage access only through Staff Portal → Access. Existing PIN sign-in and personal invitation URLs are unchanged. Access can create a missing linked account for an employee with a recognised grade; a saved clocking PIN is still required to enable PIN access.

Deploy both new migrations with `npx prisma migrate deploy`:

- `20260922023000_staff_grades`: establishes the five grades, maps matching existing text titles to their access levels, maps Care Assistant to Support Worker, updates already-linked account permissions and revokes affected sessions.
- `20260922024000_staff_grade_defaults`: fills defaults for capability keys that did not exist in older access-level records, retaining every explicit existing permission choice.

Matching is case-insensitive and trims surrounding spaces. Unknown job titles are preserved for manual review and cannot be saved as new arbitrary titles. Existing employees, PIN hashes, photographs, personal links, requests and other HR records are not deleted. Existing configured grade permission sets are retained. Employees without a linked user receive one when invited; migration does not issue invitations automatically.

Users & Permissions capability is required to assign grades because this changes account access. Only administrators may assign Administrator or change an existing administrator's grade. The current operator cannot use a staff profile to change their own assigned access level. Ordinary profile updates with unchanged grades do not require a new access assignment. Employment-change approvals follow the same grade/access checks.

Settings → Access Levels presents the five fixed names for permission editing. The former free-form access assignment API now directs callers to the staff job-title workflow and Staff Portal → Access.

Validation: both migrations applied successfully to the disposable MariaDB database. HTTP checks verified the five grade choices, automatic account assignment, grade changes, password preservation, session revocation and rejection of arbitrary titles/obsolete manual assignments. Staff invite, PIN, passkey, request and private-document regression checks passed. TypeScript and lint checks passed with 17 existing lint warnings.
