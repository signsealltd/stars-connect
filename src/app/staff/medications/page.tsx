import {redirect} from "next/navigation";
import {staffSession} from "@/lib/staff-area-auth";
import {hasCapability,CAPABILITIES} from "@/lib/permission-catalog";
import {MedicationManager} from "@/components/medication-manager";
import Link from "next/link";
export default async function Page(){const i=await staffSession();if(!i)redirect("/staff/");if(!hasCapability(i.user.role,CAPABILITIES.MEDICATION_VIEW,i.user.permissionOverrides))redirect("/staff/");return <div className="content"><Link href="/staff/">Back to Staff Area</Link><MedicationManager staff/></div>}
