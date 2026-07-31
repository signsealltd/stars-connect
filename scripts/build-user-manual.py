"""Render the manual with stable bookmarks and approved inline formatting."""
import importlib.util,re
from pathlib import Path
from reportlab.platypus import Paragraph
source=Path(__file__).with_name("create-complete-user-manual.py")
spec=importlib.util.spec_from_file_location("stars_manual",source);manual=importlib.util.module_from_spec(spec);spec.loader.exec_module(manual)
manual.safe=lambda value:str(value)
manual.styles["H2Manual"].tocLevel=None
def stable_after_flowable(self,flowable):
    if isinstance(flowable,Paragraph) and getattr(flowable.style,"tocLevel",None)==0:
        text=flowable.getPlainText();key="section-"+re.sub(r"[^a-z0-9]+","-",text.lower()).strip("-")
        self.canv.bookmarkPage(key);self.canv.addOutlineEntry(text,key,level=0,closed=False);self.notify("TOCEntry",(0,text,self.page,key))
manual.ManualDoc.afterFlowable=stable_after_flowable
manual.build()
