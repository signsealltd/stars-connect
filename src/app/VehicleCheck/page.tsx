import type {Metadata} from "next";
import {VehicleCheckApp} from "@/components/vehicle-check-app";
export const metadata:Metadata={title:"STARS Vehicle Checks",manifest:"/VehicleCheck/manifest.webmanifest",applicationName:"STARS Vehicle Checks",appleWebApp:{capable:true,title:"Vehicle Checks"}};
export default function Page(){return <VehicleCheckApp/>}
