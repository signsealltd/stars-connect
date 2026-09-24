import {Header} from "@/components/header";
import {MedicationManager} from "@/components/medication-manager";
import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
export default async function Page(){await requirePageCapability(CAPABILITIES.MEDICATION_VIEW);return <main className="shell"><Header manager/><div className="content"><MedicationManager/></div></main>}
