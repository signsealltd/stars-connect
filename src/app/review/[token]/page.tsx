import type { Metadata } from "next";
import { PublicInformationReview } from "@/components/public-information-review";

export const metadata: Metadata = { title: "Information review | STARS Connect", robots: { index: false, follow: false, noarchive: true } };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  return <PublicInformationReview token={(await params).token}/>;
}
