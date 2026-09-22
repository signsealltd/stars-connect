import {VehicleCheckApp} from "@/components/vehicle-check-app";
import {APP_VERSION_LABEL} from "@/lib/app-version";
export default function Page(){return <><VehicleCheckApp staffArea/><small className="staff-version">{APP_VERSION_LABEL}</small></>}
