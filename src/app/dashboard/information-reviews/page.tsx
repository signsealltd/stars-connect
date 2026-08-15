import { Header } from "@/components/header";
import { InformationReviewManager } from "@/components/information-review-manager";
import { CAPABILITIES, requirePageCapability } from "@/lib/permissions";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function InformationReviewsPage(){await requirePageCapability(CAPABILITIES.INFORMATION_REVIEW_VIEW);return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Information reviews</h1><p className="muted">Request, monitor and approve annual student information updates. Submissions never overwrite live records automatically.</p></div><Link className="btn secondary" href="/api/information-reviews/paper-form">Download blank paper form</Link></div><InformationReviewManager/></div></main>}
