import { NextRequest, NextResponse } from "next/server";
import { withCapability } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { simplePdf } from "@/lib/documents";

export async function GET(req: NextRequest) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_VIEW, async () => {
    const sections = [
      "STUDENT DETAILS", "Name:", "Date of birth:", "Address:", "Telephone / email:", "NHS / hospital number:", "",
      "EMERGENCY CONTACTS", "Primary contact / relationship:", "Telephone / email:", "Second contact / relationship:", "Telephone / email:", "",
      "MEDICAL", "GP / surgery / telephone:", "Medical conditions:", "Allergies:", "Emergency and current medication:", "Instructions:", "",
      "PERSON-CENTRED INFORMATION", "Communication:", "Support strategies:", "Interests / dislikes:", "Triggers / calming strategies:", "Goals:", "",
      "CONSENTS (record Yes or No separately)", "Photography/video:", "Local outings:", "STARS transport:", "Emergency treatment:", "Necessary information sharing:", "",
      "BILLING", "Payer / organisation:", "Billing email / telephone:", "Address / reference:", "",
      "DECLARATION", "Name and relationship/capacity:", "Signature:", "Date:",
    ];
    return new NextResponse(simplePdf("Blank annual information update form", sections), { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=stars-blank-information-review.pdf", "cache-control": "private, no-store" } });
  });
}
