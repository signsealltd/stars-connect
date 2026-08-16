import { PublicInformationReview } from "@/components/public-information-review";
import { CAPABILITIES, requirePageCapability } from "@/lib/permissions";

export default async function InformationReviewPreviewPage() {
  await requirePageCapability(CAPABILITIES.INFORMATION_REVIEW_VIEW);
  return <PublicInformationReview token="preview" preview />;
}
