"""Generate the client-facing STARS Connect Complete User Manual.

Content is derived from knowledge/workflows/catalog.json so the PDF, in-app
help, guided lessons and Clive use the same approved workflow source.
"""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, ListFlowable, ListItem, Image
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"knowledge"/"workflows"/"catalog.json"
OUTPUT=ROOT/"output"/"pdf"/"STARS-Connect-Complete-User-Manual.pdf"
PURPLE=colors.HexColor("#54205d"); MID=colors.HexColor("#8d349b")
PALE=colors.HexColor("#f7f3f8"); INK=colors.HexColor("#201823")
MUTED=colors.HexColor("#6f6173"); GREEN=colors.HexColor("#087a54")

class ManualDoc(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        frame=Frame(self.leftMargin,self.bottomMargin,self.width,self.height,id="normal")
        self.addPageTemplates(PageTemplate(id="manual",frames=frame,onPage=self.decorate))
        self._bookmark=0
    def decorate(self,canvas,doc):
        canvas.saveState()
        if doc.page>1:
            canvas.setStrokeColor(colors.HexColor("#dfd5e1"));canvas.line(18*mm,18*mm,192*mm,18*mm)
            canvas.setFont("Helvetica",8);canvas.setFillColor(MUTED)
            canvas.drawString(18*mm,12*mm,"STARS Connect - Complete User Manual")
            canvas.drawRightString(192*mm,12*mm,f"Page {doc.page}")
        canvas.restoreState()
    def afterFlowable(self,flowable):
        if isinstance(flowable,Paragraph):
            level=getattr(flowable.style,"tocLevel",None)
            if level is not None:
                self._bookmark+=1;key=f"section-{self._bookmark}"
                self.canv.bookmarkPage(key);self.canv.addOutlineEntry(flowable.getPlainText(),key,level=level,closed=False)
                self.notify("TOCEntry",(level,flowable.getPlainText(),self.page,key))

def safe(text): return str(text).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle",parent=styles["Title"],fontName="Helvetica-Bold",fontSize=31,leading=35,textColor=PURPLE,alignment=TA_CENTER,spaceAfter=12))
styles.add(ParagraphStyle(name="CoverSub",parent=styles["Normal"],fontSize=15,leading=21,textColor=MUTED,alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1Manual",parent=styles["Heading1"],fontSize=23,leading=27,textColor=PURPLE,spaceBefore=8,spaceAfter=12,tocLevel=0))
styles.add(ParagraphStyle(name="H2Manual",parent=styles["Heading2"],fontSize=15,leading=19,textColor=PURPLE,spaceBefore=10,spaceAfter=6,tocLevel=1))
styles.add(ParagraphStyle(name="BodyManual",parent=styles["BodyText"],fontSize=10,leading=15,textColor=INK,spaceAfter=7))
styles.add(ParagraphStyle(name="SmallManual",parent=styles["BodyText"],fontSize=8.5,leading=12,textColor=MUTED))
styles.add(ParagraphStyle(name="Callout",parent=styles["BodyText"],fontSize=10,leading=15,textColor=INK,leftIndent=9,rightIndent=9,spaceBefore=6,spaceAfter=8,borderWidth=.6,borderColor=colors.HexColor("#d9c9dc"),borderPadding=9,backColor=PALE))

def heading(text,level=1): return Paragraph(safe(text),styles["H1Manual" if level==1 else "H2Manual"])
def body(text,style="BodyManual"): return Paragraph(safe(text),styles[style])
def bullets(items):
    return ListFlowable([ListItem(body(x),leftIndent=8) for x in items],bulletType="bullet",leftIndent=16,bulletFontName="Helvetica",spaceAfter=8)
def numbered(items):
    return ListFlowable([ListItem(body(x),leftIndent=8) for x in items],bulletType="1",leftIndent=19,spaceAfter=8)
def screen_map(title,labels):
    cells=[[Paragraph("<b>"+safe(title)+"</b>",styles["BodyManual"])]]
    cells += [[Paragraph(f"<b>{i+1}</b>",styles["BodyManual"]),body(label)] for i,label in enumerate(labels)]
    table=Table(cells,colWidths=[14*mm,150*mm] if len(cells[1])==2 else [164*mm])
    table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PURPLE),("TEXTCOLOR",(0,0),(-1,0),colors.white),("SPAN",(0,0),(-1,0)),("GRID",(0,1),(-1,-1),.35,colors.HexColor("#ded4e0")),("BACKGROUND",(0,1),(0,-1),PALE),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),7)]))
    return table

def build():
    data=json.loads(CATALOG.read_text(encoding="utf-8")); workflows=data["workflows"]
    version=json.loads((ROOT/"package.json").read_text(encoding="utf-8"))["version"]
    story=[]
    logo=ROOT/"public"/"branding"/"stars-logo.png"
    if logo.exists(): story += [Spacer(1,18*mm),Image(str(logo),width=58*mm,height=35*mm)]
    else: story += [Spacer(1,28*mm),Paragraph("★ STARS ★",ParagraphStyle("Mark",parent=styles["CoverTitle"],fontSize=28,textColor=MID))]
    story += [Spacer(1,12*mm),Paragraph("STARS Connect",styles["CoverTitle"]),Paragraph("Complete User Assistance, Training and Troubleshooting Manual",styles["CoverSub"]),Spacer(1,14*mm)]
    story += [Table([[body("<b>Application version</b>"),body(version)],[body("<b>Manual revision</b>"),body("1.0")],[body("<b>Generated</b>"),body(datetime.now().strftime("%d %B %Y"))],[body("<b>Audience</b>"),body("Reception staff, care staff, Managers, Directors and Administrators")]],colWidths=[48*mm,105*mm],style=TableStyle([("GRID",(0,0),(-1,-1),.4,colors.HexColor("#d9cbdc")),("BACKGROUND",(0,0),(0,-1),PALE),("PADDING",(0,0),(-1,-1),8)]))]
    story += [Spacer(1,18*mm),body("Keep this manual available to authorised staff. It explains how to use STARS Connect; it does not replace safeguarding, emergency, payroll, data-protection or compliance policies.","Callout"),PageBreak()]
    story += [heading("Revision history"),Table([[body("<b>Revision</b>"),body("<b>Date</b>"),body("<b>Change</b>")],[body("1.0"),body(datetime.now().strftime("%d/%m/%Y")),body("Integrated workflow manual generated from application source.")]],colWidths=[25*mm,35*mm,105*mm],style=TableStyle([("GRID",(0,0),(-1,-1),.4,colors.HexColor("#d9cbdc")),("BACKGROUND",(0,0),(-1,0),PURPLE),("TEXTCOLOR",(0,0),(-1,0),colors.white),("PADDING",(0,0),(-1,-1),7)])),Spacer(1,8*mm),heading("Contents"),TableOfContents(),PageBreak()]
    story += [heading("1. Getting started"),body("STARS Connect combines kiosk attendance, student and visitor registers, emergency roll call, management records, payroll, billing, reports, premises compliance, device health, backups and audit history."),heading("Roles and access",2)]
    role_rows=[[body("<b>Role</b>"),body("<b>Typical access</b>")],[body("Reception"),body("Everyday attendance and visitor work approved for reception.")],[body("Manager"),body("Operational records, timesheets, training, reports, payroll/billing where permitted.")],[body("Director"),body("Management and financial oversight.")],[body("Administrator"),body("System configuration, devices, users, backups and audit.")]]
    story += [Table(role_rows,colWidths=[35*mm,130*mm],style=TableStyle([("GRID",(0,0),(-1,-1),.4,colors.HexColor("#d9cbdc")),("BACKGROUND",(0,0),(-1,0),PURPLE),("TEXTCOLOR",(0,0),(-1,0),colors.white),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),7)])),heading("Safe daily habits",2),bullets(["Use your own account and PIN.","Check device sync and queues before relying on totals.","Sign out of shared management computers.","Do not share exports, photographs, signatures, payroll files or provisioning codes.","Use Emergency Register only for a drill or real incident."]),heading("Understanding the interface",2),screen_map("Manager screen map",["Top navigation: open People, Attendance, Premises, Finance, Reports and Settings.","Page title and explanation: confirm you are on the intended screen.","Primary action: purple buttons create or save records.","Warnings: read and resolve; do not hide them.","Help: opens guidance for the current page.","Ask Clive: answers approved STARS Connect questions."]),PageBreak()]
    number=2
    for workflow in workflows:
        story += [heading(f"{number}. {workflow['title']}"),body(workflow["summary"],"Callout"),heading("Purpose",2),body(workflow["purpose"]),heading("Before you begin",2),bullets(workflow["before"]),heading("Step-by-step",2),numbered([f"{x['title']}: {x['instruction']}" for x in workflow["steps"]]),screen_map("What to look for on screen",[x["title"] for x in workflow["steps"]]),heading("Expected outcome",2),Paragraph("✓ "+safe(workflow["outcome"]),ParagraphStyle("Success",parent=styles["Callout"],textColor=GREEN)),heading("Warnings and common mistakes",2),bullets(workflow["warnings"]+workflow["mistakes"]),heading("If it does not work",2),numbered(workflow["recovery"]),heading("Frequently asked question",2)]
        for faq in workflow["faq"]: story += [Paragraph("<b>"+safe(faq["question"])+"</b>",styles["BodyManual"]),body(faq["answer"])]
        story += [PageBreak()]; number+=1
    story += [heading(f"{number}. Troubleshooting checklist"),body("Work from top to bottom. Stop before deleting data, clearing storage, resetting a database or changing permissions."),Table([[body("<b>Symptom</b>"),body("<b>Safe checks</b>")],[body("A kiosk action has not reached management"),body("Check Online state, queued uploads, last sync, conflicts and device status. Force sync only after confirming the kiosk can respond.")],[body("A page says access denied"),body("Confirm the signed-in account and approved role. Do not grant Administrator merely to bypass one restriction.")],[body("Payroll or billing total is wrong"),body("Check source attendance, date period, duplicate adjustments, effective charge rule, rates, rounding and warnings. Refresh calculations before approval.")],[body("A report is empty"),body("Check date range and underlying attendance. Daily reports normally use the previous complete London day.")],[body("A document will not open"),body("Confirm the upload completed and permissions allow access. Preserve the source document.")],[body("The PWA appears out of date"),body("Complete deployment checks, then fully close and reopen the installed PWA. Do not clear queued local data.")]],colWidths=[52*mm,113*mm],style=TableStyle([("GRID",(0,0),(-1,-1),.4,colors.HexColor("#d9cbdc")),("BACKGROUND",(0,0),(-1,0),PURPLE),("TEXTCOLOR",(0,0),(-1,0),colors.white),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),7)])),PageBreak()]
    story += [heading(f"{number+1}. Security and data handling"),bullets(["Use unique named accounts and least-privilege roles.","Never share PINs, passwords, setup codes, API keys, device credentials or SMTP passwords.","Treat student contacts, signatures, photographs, attendance, payroll, invoices and exports as confidential.","Revoke lost devices promptly and review the audit log.","Create and verify a backup before updates, migrations or data cleanup.","Do not query, reset or restore a database unless its identity and purpose are positively confirmed."]),heading("What to record for support",2),bullets(["Date and exact time.","Page and action attempted.","Signed-in role, not the password.","Friendly device name and app version.","Online state, queue and conflict counts.","Exact safe error wording.","Whether another authorised device shows the same problem."]),PageBreak()]
    story += [heading(f"{number+2}. Glossary and index"),Table([[body("<b>Term</b>"),body("<b>Meaning</b>")],[body("Billing profile"),body("The payer and charge rules linked to one student.")],[body("Conflict"),body("Two devices changed related information and management review is required.")],[body("Device credential"),body("The secret authorising a provisioned kiosk; separate from a user login.")],[body("Immutable"),body("A record preserved as originally created; corrections are added rather than silently replacing it.")],[body("Payer"),body("The council, organisation, family member or party receiving an invoice.")],[body("Provisioning code"),body("A one-time expiring code used to authorise a device.")],[body("Queue"),body("Changes safely waiting on a kiosk to upload.")],[body("STARS Connect"),body("The attendance, register, operations, finance and compliance application described in this manual.")]],colWidths=[42*mm,123*mm],style=TableStyle([("GRID",(0,0),(-1,-1),.4,colors.HexColor("#d9cbdc")),("BACKGROUND",(0,0),(-1,0),PURPLE),("TEXTCOLOR",(0,0),(-1,0),colors.white),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),7)])),Spacer(1,8*mm),body("Index: attendance; audit; backup; billing; camera; Clive; compliance; correction; device; emergency; export; invoice; kiosk; payroll; permissions; PIN; premises; provisioning; register; report; student; sync; timesheet; transport; visitor.")]
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    doc=ManualDoc(str(OUTPUT),pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=23*mm,title="STARS Connect Complete User Manual",author="STARS Connect")
    doc.multiBuild(story)
    print(OUTPUT)
if __name__=="__main__":build()
