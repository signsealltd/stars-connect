import { Header } from "@/components/header";
import { InformationReviewApproval } from "@/components/information-review-approval";
import { CAPABILITIES, requirePageCapability } from "@/lib/permissions";
import Link from "next/link";
export const dynamic="force-dynamic";
export default async function InformationReviewPage({params}:{params:Promise<{id:string}>}){await requirePageCapability(CAPABILITIES.INFORMATION_REVIEW_VIEW);const{id}=await params;return <main className="shell"><Header manager/><div className="content"><div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Link className="btn secondary" href={`/api/information-reviews/${id}/pdf`}>Download archival PDF</Link></div><InformationReviewApproval id={id}/></div></main>}
