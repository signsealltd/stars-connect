from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, ListFlowable, ListItem, Image
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT / "STARS-Connect-Client-User-Guide.pdf"

PRIMARY = colors.HexColor("#5A2162")
PRIMARY_DARK = colors.HexColor("#34143A")
PRIMARY_SOFT = colors.HexColor("#F4EAF6")
INK = colors.HexColor("#211923")
MUTED = colors.HexColor("#6E6470")
GREEN = colors.HexColor("#187552")
AMBER = colors.HexColor("#A46208")
RED = colors.HexColor("#A13434")
LINE = colors.HexColor("#DED5E0")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
                          fontSize=30, leading=34, textColor=colors.white, alignment=TA_CENTER,
                          spaceAfter=8))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica",
                          fontSize=14, leading=20, textColor=colors.HexColor("#EADDEC"),
                          alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold",
                          fontSize=22, leading=27, textColor=PRIMARY_DARK, spaceBefore=4,
                          spaceAfter=12, keepWithNext=True))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold",
                          fontSize=15, leading=19, textColor=PRIMARY, spaceBefore=14,
                          spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=9.7, leading=14.2, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold",
                          fontSize=9.4, leading=14, textColor=PRIMARY_DARK, backColor=PRIMARY_SOFT,
                          borderColor=colors.HexColor("#D6B9DB"), borderWidth=.6, borderPadding=9,
                          spaceBefore=8, spaceAfter=10))
styles.add(ParagraphStyle(name="Warning", parent=styles["BodyText"], fontName="Helvetica-Bold",
                          fontSize=9.3, leading=14, textColor=colors.HexColor("#6F4207"),
                          backColor=colors.HexColor("#FFF4DD"), borderColor=colors.HexColor("#E6C783"),
                          borderWidth=.6, borderPadding=9, spaceBefore=8, spaceAfter=10))
styles.add(ParagraphStyle(name="Codex", parent=styles["Code"], fontName="Courier", fontSize=8,
                          leading=11, backColor=colors.HexColor("#F3F0F4"), borderPadding=7,
                          spaceBefore=5, spaceAfter=8))


class GuideDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
                         topMargin=20*mm, bottomMargin=18*mm, title="STARS Connect Client User Guide",
                         author="STARS Connect")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates(PageTemplate(id="normal", frames=frame, onPage=self.header_footer))

    def header_footer(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(18*mm, A4[1]-13*mm, A4[0]-18*mm, A4[1]-13*mm)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(PRIMARY)
        canvas.drawString(18*mm, A4[1]-10*mm, "STARS Connect")
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(A4[0]-18*mm, 10*mm, f"Client User Guide  |  Page {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "H1x":
            text = flowable.getPlainText()
            key = "h1-%s" % self.seq.nextf("heading")
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=0, closed=False)
            self.notify("TOCEntry", (0, text, self.page, key))


def P(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def bullets(items):
    return ListFlowable(
        [ListItem(P(item), leftIndent=8) for item in items],
        bulletType="bullet", leftIndent=16, bulletFontName="Helvetica",
        bulletFontSize=7, spaceAfter=7
    )


def table(rows, widths=None, header=True):
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.2),
        ("LEADING", (0, 0), (-1, -1), 11.2),
        ("GRID", (0, 0), (-1, -1), .4, LINE),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, colors.HexColor("#FAF8FA")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    t.setStyle(TableStyle(commands))
    return t


story = []

# Cover
cover = Table([[Spacer(1, 32*mm)], [P("STARS Connect", "CoverTitle")],
               [P("Complete Client User Guide", "CoverSub")],
               [Spacer(1, 8*mm)],
               [P("Attendance, registers, visitors, payroll, billing, training, premises compliance and tablet management", "CoverSub")],
               [Spacer(1, 32*mm)]], colWidths=[174*mm])
cover.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_DARK),
    ("BOX", (0, 0), (-1, -1), 0, PRIMARY_DARK),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 15*mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 15*mm),
]))
story += [Spacer(1, 12*mm), cover, Spacer(1, 16*mm),
          P("<b>Prepared for:</b> STARS Day Service"), P("<b>Application:</b> STARS Connect V1"),
          P("<b>Website:</b> app.starsconnect.co.uk"), P("<b>Document purpose:</b> Client handover, user training and operational reference"),
          Spacer(1, 8*mm),
          P("This guide describes the current application and recommended operating procedures. It should be used alongside the organisation's own safeguarding, data protection, payroll, finance, fire safety and business continuity policies.", "Callout"),
          PageBreak()]

story += [P("Contents", "H1x")]
toc = TableOfContents()
toc.levelStyles = [ParagraphStyle(name="TOC", fontName="Helvetica", fontSize=9.5, leading=14,
                                  leftIndent=0, firstLineIndent=0, textColor=INK)]
story += [toc, PageBreak()]

sections = []
def section(title):
    story.append(P(title, "H1x"))
def sub(title):
    return P(title, "H2x")

section("1. About STARS Connect")
story += [P("STARS Connect is a tablet-first progressive web application (PWA) for the day-to-day administration of STARS Day Service. It combines kiosk attendance functions with a protected management area."),
          P("The application is designed to keep operational records in one place while allowing provisioned tablets to continue recording key attendance activity during temporary connectivity problems."),
          sub("Main capabilities"),
          bullets([
              "<b>Staff attendance:</b> PIN-based clock in and clock out, with timesheets and correction records.",
              "<b>Student register:</b> Present, Absent and Offsite marking with protected access to student names.",
              "<b>Visitor management:</b> Sign in, site-rule acceptance, signature, private visit reference and sign out.",
              "<b>Emergency roll call:</b> A dedicated live roll-call view that takes priority over normal kiosk behaviour.",
              "<b>Management dashboard:</b> Live operational counts, exceptions, reports and device health.",
              "<b>Finance:</b> Controlled payroll and billing workflows with review, approval, locking and document generation.",
              "<b>People compliance:</b> Staff training records and renewal monitoring.",
              "<b>Premises compliance:</b> Assets, statutory tests, corrective actions, insurance and renewal dates.",
              "<b>Administration:</b> Users, permissions, devices, email, backups, version information and audit history."
          ]),
          P("STARS Connect is a record-management tool. It does not replace professional payroll software, statutory inspection services, formal accounting, legal advice or the organisation's emergency procedures.", "Warning")]

section("2. Roles and access")
story += [P("Each manager account has a role. Access is enforced by the server, not only by hiding menu items."),
          table([
              ["Role", "Typical access"],
              ["Reception", "Limited reception and visitor-facing access where enabled."],
              ["Manager", "Dashboard, people, attendance review, operational reports, screensaver settings and selected finance review."],
              ["Director", "Manager functions plus approval functions, email settings, staff training and Premises & Compliance."],
              ["Administrator", "Full system administration including users, devices, organisation settings, backups, audit history and destructive administrative actions."]
          ], [32*mm, 140*mm]),
          sub("Good account practice"),
          bullets([
              "Give every person their own named account. Do not share manager passwords.",
              "Assign the lowest role that allows the person to perform their work.",
              "Disable or remove accounts promptly when access is no longer needed.",
              "Use a unique password of at least 12 characters.",
              "Sign out when leaving a shared management computer."
          ])]

section("3. Getting started")
story.append(sub("Manager access"))
story += [bullets([
    "Open <b>app.starsconnect.co.uk</b>.",
    "Select <b>Manager Login</b> from the kiosk home.",
    "Enter the email address and password supplied by an administrator.",
    "After signing in, use the purple management header to move between Dashboard, People, Attendance, Premises, Finance, Reports and Settings.",
    "Select <b>Sign out</b> when finished."
]),
P("Manager authentication and tablet provisioning are separate. A manager can sign in on an ordinary computer without turning it into a kiosk device.", "Callout")]
story.append(sub("Tablet provisioning"))
story += [bullets([
    "An administrator opens <b>Settings > Devices</b> and selects <b>Provision device</b>.",
    "Enter a clear friendly name, such as Reception Tablet or Activity Room Tablet.",
    "Record the eight-digit one-time code. It expires after 15 minutes and is displayed once.",
    "On the tablet, open <b>/setup</b>, enter the code and select <b>Authorise tablet</b>.",
    "The tablet stores its device credential in that browser and opens the kiosk home.",
    "Install the PWA to the Android home screen and configure Android to remain awake while charging."
]),
P("Do not share a provisioning code in an email or document. If a code is exposed, allow it to expire or create a replacement.", "Warning")]

section("4. Kiosk home and idle screensaver")
story += [P("The kiosk home provides large actions for staff clocking, the student register, visitor sign in/out and the emergency register. It also shows connectivity, last sync and queued-upload information."),
          sub("Idle screensaver"),
          bullets([
              "On a provisioned tablet home screen, the screensaver starts after the configured idle period (30 seconds by default).",
              "It shows only branding, local time/date, connection state and device/location name. It never shows names or attendance data.",
              "The first touch wakes the screen and returns to kiosk home; it cannot activate a button underneath.",
              "The display becomes progressively dimmer during day, evening and night periods.",
              "The constellation animation is stored within the app and continues offline.",
              "The screensaver is suspended during PIN entry, visitor forms, the student register, tablet setup and emergency roll call."
          ]),
          P("Configure this under <b>Settings > Kiosk Screensaver</b>. Settings are cached on tablets for offline operation.", "Callout")]

section("5. Staff clocking")
story += [P("Staff clocking uses each staff member's private PIN."),
          sub("Clock in or out"),
          bullets([
              "Select <b>Clock In / Out</b>.",
              "Enter the staff PIN using the on-screen keypad.",
              "Confirm the staff member and the proposed Clock In or Clock Out action.",
              "Complete camera confirmation if required by the organisation's settings.",
              "Wait for the success confirmation before leaving the tablet."
          ]),
          sub("PIN administration"),
          bullets([
              "Managers can add or reset a PIN from <b>People > Staff</b>.",
              "PINs must contain 4 to 8 digits and must be unique.",
              "PIN values are not displayed after saving.",
              "Reset a PIN immediately if another person may know it."
          ]),
          P("If clocking is unavailable, record the actual time separately and ask a manager to create a documented correction. Do not invent an approximate time.", "Warning")]

section("6. Student register")
story += [P("The register contains student names and is therefore protected."),
          bullets([
              "A kiosk user selects <b>Student Register</b> and an active staff member enters their PIN.",
              "A signed-in Manager, Director or Administrator bypasses the register PIN prompt.",
              "Mark each student as <b>Present</b>, <b>Absent</b> or <b>Offsite</b>.",
              "Changes are saved locally immediately and queued for synchronisation.",
              "Use <b>Lock</b> or return to kiosk home when finished so names are no longer visible."
          ]),
          table([
              ["Status", "Meaning"],
              ["Present", "The student is currently attending on site."],
              ["Absent", "The student is expected or enrolled but is not attending."],
              ["Offsite", "The student is attending the service but temporarily away from the premises."]
          ], [32*mm, 140*mm]),
          P("The enrolled student count and the live present count are different concepts. Dashboard presence figures should be checked against the live attendance view, not the total number of student records.", "Callout")]

section("7. Visitor management")
story += [P("Visitors can sign themselves in and out without seeing other visitor records."),
          sub("Visitor sign in"),
          bullets([
              "Select <b>Visitor Sign In / Out</b>, then <b>Sign in</b>.",
              "Enter the requested identity, company, host, contact and vehicle details.",
              "Choose the reason for the visit.",
              "Read and accept the current site rules.",
              "Provide a signature and submit.",
              "Keep the private visit reference shown on screen; it is required for self-service sign out."
          ]),
          sub("Visitor sign out"),
          bullets([
              "Choose <b>Sign out</b>.",
              "Enter the visitor's full name and private visit reference.",
              "Confirm sign out and wait for the success message."
          ]),
          P("Managers can review visitor records under <b>People > Visitors</b>. Contact information is restricted according to role and should only be used for legitimate operational purposes.", "Warning")]

section("8. Emergency roll call")
story += [P("The emergency register is designed for live accountability during an incident."),
          bullets([
              "Select <b>Emergency Register</b> and start the roll call according to the organisation's emergency procedure.",
              "Work through the people shown and mark each person accounted for.",
              "Keep the screen visible until the responsible person closes the roll call.",
              "The screensaver and normal dimming are disabled while emergency mode is active.",
              "The display wake lock remains requested where supported."
          ]),
          P("STARS Connect supports the roll call; it does not replace evacuation, fire-service liaison, assembly-point control or other emergency responsibilities.", "Warning")]

section("9. Dashboard and live attendance")
story += [P("The management dashboard summarises the current operational position. Use <b>Force sync</b> where available to request tablet synchronisation and then refresh server data."),
          table([
              ["Dashboard item", "Description"],
              ["Staff currently in", "Staff whose latest valid clock event leaves them clocked in."],
              ["Students present", "Students marked Present in the live register data."],
              ["Visitors on site", "Visitors signed in without a corresponding sign out."],
              ["Expected / not marked", "Register exceptions requiring review."],
              ["Missing clock-outs", "Staff attendance sequences that appear incomplete."],
              ["Payroll / billing awaiting review", "Finance periods requiring authorised review."],
              ["Stale devices", "Provisioned devices that have not recently synchronised."]
          ], [48*mm, 124*mm]),
          P("<b>Attendance > Live attendance</b> provides the names behind the live counts, subject to the user's permissions.", "Callout")]

section("10. Managing staff")
story += [bullets([
    "Open <b>People > Staff</b>.",
    "Use <b>Add staff</b> to create a profile with name, contact details, job title and start date.",
    "Set or reset the clocking PIN where required.",
    "Configure payroll number, contracted weekly hours and hourly rate for payroll handover.",
    "Use restricted manager notes only for necessary operational information.",
    "Archive a staff profile when the person leaves. Historic attendance records remain available."
]),
P("The display name can be informal for the kiosk, but payroll reports use the full first name and surname.", "Callout")]

section("11. Managing students")
story += [bullets([
    "Open <b>People > Students</b>.",
    "Create or edit the student's first name, surname, display name, internal reference and attendance pattern.",
    "Enter funding information only where it is needed for authorised billing work.",
    "Archive or remove records according to the organisation's approved retention process.",
    "After major changes, confirm that provisioned tablets have synchronised."
]),
P("Avoid placing health, safeguarding or care-plan details in general notes unless the field and access controls are formally approved for that purpose.", "Warning")]

section("12. Staff training")
story += [P("<b>People > Staff Training</b> is available to Managers, Directors and Administrators."),
          bullets([
              "Select <b>Add training</b>.",
              "Choose the staff member and enter the training or qualification name.",
              "Record provider, completion date, expiry/renewal date and certificate reference.",
              "Mark mandatory training where applicable.",
              "Use filters to identify current, due-soon, expired and no-expiry records.",
              "Edit inaccurate records or archive records that should no longer appear in the active list."
          ]),
          P("A training record is evidence tracking, not proof that a course satisfies a regulator or awarding body's requirements. Retain original certificates in approved storage.", "Callout")]

section("13. Timesheets and attendance corrections")
story += [P("Timesheets are created from staff clock events. Managers should review exceptions before payroll approval."),
          bullets([
              "Open <b>Attendance > Timesheets</b> or the relevant payroll period.",
              "Check clock-in/out pairs, dates, durations and device timestamps.",
              "If a correction is required, enter the actual corrected value and a meaningful reason.",
              "Corrections preserve the original value and are recorded in the audit history.",
              "Resolve missing clock-outs and other exceptions before approving payroll."
          ]),
          P("Never alter a clock record merely to make totals look correct. Corrections must reflect evidence and an authorised explanation.", "Warning")]

section("14. Devices and synchronisation")
story += [P("<b>Settings > Devices</b> is administrator-only."),
          bullets([
              "Provision devices with a friendly name and one-time eight-digit code.",
              "Monitor active, stale and revoked states, last sync, pending uploads and app version.",
              "Rename a device when its physical location changes.",
              "Rotate a credential if compromise is suspected.",
              "Revoke lost, replaced or unauthorised devices immediately.",
              "Use force sync to request a provisioned tablet to upload and refresh."
          ]),
          sub("Understanding offline queues"),
          P("Provisioned tablets retain legitimate queued attendance data until synchronisation succeeds. An unprovisioned desktop queue is separate and can be inspected and cleared safely from synchronisation settings. Never clear a provisioned tablet's local data while uploads are pending unless an authorised recovery plan exists.")]

section("15. Payroll")
story += [P("Payroll uses a controlled period workflow."),
          table([
              ["Stage", "Purpose"],
              ["Draft", "Create the pay period and calculate entries."],
              ["Requires review", "Review every included employee and all exceptions."],
              ["Approved", "An authorised user records approval; the approver name and time are retained."],
              ["Locked", "The period becomes immutable for document generation."],
              ["Exported", "Timesheets, payroll summary and CSV have been generated."]
          ], [38*mm, 134*mm]),
          bullets([
              "Configure each staff member's payroll number and hourly rate before calculation.",
              "Payroll entries use the staff member's full first name and surname.",
              "Estimated gross pay is hours multiplied by the configured hourly rate. It is not a PAYE calculation.",
              "Review exclusions, adjustments and exceptions before approval.",
              "Generated reports show the named approving user."
          ]),
          P("The accountant or payroll provider remains responsible for PAYE, tax, National Insurance, pension, statutory payments, deductions and final pay calculations.", "Warning")]

section("16. Billing")
story += [P("Billing profiles connect students to payers and charge rules."),
          bullets([
              "Configure the organisation's legal, address, payment and invoice settings.",
              "Create a billing profile for the service user and payer.",
              "Add the relevant charge rule, rate, VAT treatment and active dates.",
              "Create and calculate a billing run for the required period.",
              "Review source attendance, exceptions and manual adjustments.",
              "Approve and lock the run before generating invoices.",
              "Retain issued invoices according to finance and legal requirements."
          ]),
          P("VAT treatment and invoice content must be reviewed by an appropriately qualified person.", "Warning")]

section("17. Reports and email")
story += [bullets([
    "Operational reports are available from <b>Reports</b>.",
    "Daily reports can include attendance, staff and visitor summaries according to configuration.",
    "Generated documents are stored with hashes and immutable version references.",
    "Email settings allow authorised users to configure SMTP securely, test connectivity and send a test message.",
    "SMTP passwords are encrypted and are never returned to the browser after saving.",
    "Use delivery history and safe error categories when investigating email failures."
]),
P("A successful SMTP response means the mail server accepted the message; it does not guarantee final delivery to the recipient's inbox.", "Callout")]

section("18. Premises and compliance")
story += [P("<b>Premises > Premises & Compliance</b> is available to Directors and Administrators."),
          table([
              ["Area", "Use"],
              ["Overview", "Active assets, overdue tests, due-soon work, open actions and expired documents."],
              ["Assets & Systems", "Fire alarm, emergency lighting, extinguishers, electrical, heating, water hygiene, security, lifts/access and building fabric."],
              ["Tests & Inspections", "Completed date, result, contractor, certificate/reference and next due date."],
              ["Corrective Actions", "Priority, assignment, due date and Open/In progress/Completed status."],
              ["Documents & Insurance", "Insurance, risk assessments, service reports, certificates, warranties and secure document links."],
              ["Compliance Calendar", "A combined chronological view of tests, renewals and corrective-action deadlines."]
          ], [43*mm, 129*mm]),
          P("A failed or Action Required inspection automatically creates a corrective action. This helps ensure that the result is not recorded without follow-up.", "Callout"),
          P("The module supports oversight but does not certify legal compliance. Statutory frequencies, competent-person requirements and evidence must be confirmed against current law, insurer requirements and professional advice.", "Warning")]

section("19. Users and permissions")
story += [P("<b>Settings > Users & Permissions</b> is administrator-only."),
          bullets([
              "Create a named user and choose the appropriate role.",
              "Reset passwords without viewing the previous password.",
              "Disable access temporarily or delete the account when removal is appropriate.",
              "Role or password changes terminate existing sessions where configured.",
              "Do not delete the final active administrator account."
          ])]

section("20. Settings and organisation configuration")
story += [table([
    ["Setting area", "Purpose"],
    ["Organisation", "Operational defaults, retention, visitor requirements and camera mode."],
    ["Email", "Encrypted SMTP settings, health checks, tests and delivery history."],
    ["Kiosk Screensaver", "Idle timeout, message, clock/date, constellation, device name and day/night dimming."],
    ["Devices", "Provisioning, health, rotation and revocation."],
    ["Synchronisation", "Tablet queues, health and safe sync failure categories."],
    ["Version & Backups", "Installed version/commit and administrator database backups."],
    ["Audit Log", "Review significant user, finance, device, report and configuration actions."]
], [48*mm, 124*mm]),
P("Changes to retention, finance, email, security or device settings should follow an authorised change process.", "Warning")]

section("21. Backups, updates and recovery")
story.append(sub("Create a database backup"))
story += [bullets([
    "Open <b>Settings > Version & Backups</b> as an Administrator.",
    "Select <b>Create database backup</b>.",
    "Wait for confirmation and verify that the file size is greater than zero.",
    "Download the backup to approved encrypted storage.",
    "Record the backup date and test restoration periodically in a separate environment."
]),
P("Database backups contain personal data. They must not be stored in public folders, ordinary email, unencrypted USB drives or consumer file-sharing services without approval.", "Warning")]
story.append(sub("Deploy an approved update"))
story += [P("An authorised server administrator runs the controlled deployment from the application directory:"), P("bash scripts/deploy-vps.sh", "Codex"),
          bullets([
              "The script creates a pre-deployment database backup.",
              "It fast-forwards the approved GitHub main branch.",
              "It installs locked dependencies, applies Prisma migrations and generates the client.",
              "It builds the production application and restarts/saves the PM2 process.",
              "It stops if any stage fails."
          ]),
          P("Do not expose the deployment script as a public web endpoint. Keep server and GitHub credentials restricted.", "Warning")]

section("22. Offline operation and PWA use")
story += [bullets([
    "Provisioned tablets can retain permitted attendance and visitor changes locally during a temporary connection failure.",
    "The status indicator changes to Offline without repeatedly reloading the page.",
    "Queued changes synchronise when connectivity returns.",
    "The screensaver clock, date, branding, device name and constellation continue offline.",
    "Manager server actions require a connection and do not depend on kiosk provisioning.",
    "The service worker is limited to kiosk/offline routes and does not make ordinary manager browsers behave as tablets."
]),
P("Offline support is not a substitute for a downtime procedure. Staff must know how to maintain a safe temporary record if the device, browser or tablet itself is unavailable.", "Callout")]

section("23. Recommended operating routines")
story += [table([
    ["Frequency", "Recommended checks"],
    ["Start of day", "Confirm tablet power/network, device status, register availability and correct date/time."],
    ["During day", "Review live attendance, visitor departures, offsite statuses and sync warnings."],
    ["End of day", "Resolve missing clock-outs, confirm visitors signed out, review queues and check daily report."],
    ["Weekly", "Review stale devices, open corrective actions, due training and premises tests."],
    ["Monthly", "Review user access, backups, payroll/billing exceptions, expiring documents and audit samples."],
    ["After an update", "Check version, login, kiosk, clocking, register, visitor flow, sync, reports and backups."]
], [34*mm, 138*mm])]

section("24. Troubleshooting")
story += [table([
    ["Problem", "Recommended action"],
    ["Tablet says unprovisioned", "Check browser storage was not cleared. Provision again with a new code if necessary."],
    ["Synchronisation rejected", "Check device is active, credential has not been revoked and server time/network are correct."],
    ["Queued uploads remain", "Keep the provisioned tablet online and use force sync. Do not clear its storage."],
    ["Manager login fails", "Check email/password, account status and role. Ask an Administrator to reset access."],
    ["PIN not recognised", "Check the correct staff profile is active and reset the PIN if authorised."],
    ["Dashboard count looks wrong", "Force sync, check live attendance and inspect the underlying names/statuses."],
    ["Backup download fails", "Refresh Version & Backups and use the Download button. Confirm the backup still exists on the active app instance."],
    ["Email fails", "Run SMTP health check and review safe delivery history. Confirm server firewall and credentials."],
    ["Screensaver does not appear", "Confirm device is provisioned, screensaver is enabled and the tablet is on a passive kiosk screen."],
    ["Update/build fails", "Stop and preserve the error output. Do not bypass failed migrations. Restore or resolve using the documented deployment process."]
], [48*mm, 124*mm])]

section("25. Privacy, security and safeguarding")
story += [bullets([
    "Only collect information required for a clear operational purpose.",
    "Keep student names behind the staff-PIN or manager-session protection.",
    "Do not leave management sessions signed in on unattended devices.",
    "Treat database backups, exported reports, signatures, contact details and payroll documents as confidential.",
    "Use device revocation promptly after loss, disposal or suspected compromise.",
    "Review the audit log after significant changes or incidents.",
    "Apply approved retention periods and legal holds.",
    "Report suspected data loss, unauthorised access or safeguarding concerns through the organisation's formal procedures."
]),
P("The organisation remains the data controller and is responsible for lawful basis, privacy notices, retention schedules, access decisions, incident response and processor agreements.", "Warning")]

section("26. Glossary and support handover")
story += [table([
    ["Term", "Meaning"],
    ["PWA", "Progressive web application installable from a supported browser."],
    ["Provisioned device", "A browser holding a valid device credential for kiosk APIs and synchronisation."],
    ["Queue", "Local changes waiting to upload from a provisioned tablet."],
    ["Sync", "Exchange of authorised local tablet changes and server updates."],
    ["Stale device", "A device that has not synchronised within the expected health window."],
    ["Audit log", "A protected history of significant actions and before/after values."],
    ["Locked period", "A finance period made immutable before final document generation."],
    ["Corrective action", "Follow-up work required after a failure, issue or compliance finding."]
], [40*mm, 132*mm]),
sub("Information to retain for support"),
bullets([
    "Date and time of the issue.",
    "Page or workflow affected.",
    "User role and provisioned device name.",
    "Exact safe error message or screenshot, excluding passwords and PINs.",
    "Whether the device was online and whether uploads were queued.",
    "Installed Git commit shown under Version & Backups.",
    "Steps already attempted and whether other devices are affected."
]),
P("End of guide", "Callout")]

doc = GuideDoc(str(PDF_PATH))
doc.multiBuild(story)
print(PDF_PATH)
