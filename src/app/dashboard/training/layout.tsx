import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
export default async function TrainingLayout({children}:{children:React.ReactNode}){await requirePageCapability(CAPABILITIES.TRAINING_VIEW);return children;}
