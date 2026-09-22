import Link from "next/link";
import {VehicleCheckRecord} from "@/components/vehicle-check-record";
import {APP_VERSION_LABEL} from "@/lib/app-version";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return <main className="staff-main"><Link href="/staff/vehicle-check">Back to Vehicle check</Link>{id?<VehicleCheckRecord id={id} apiBase="/api/staff-area/vehicle"/>:<p>Choose a submitted check to view.</p>}<small className="staff-version">{APP_VERSION_LABEL}</small></main>}
