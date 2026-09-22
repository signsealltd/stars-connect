import {VehicleCheckApp} from "@/components/vehicle-check-app";
import {APP_VERSION_LABEL} from "@/lib/app-version";
export default function Page(){return <><VehicleCheckApp driverOnly/><small>{APP_VERSION_LABEL}</small></>}
