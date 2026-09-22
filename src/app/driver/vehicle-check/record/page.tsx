import Link from "next/link";
import {VehicleCheckRecord} from "@/components/vehicle-check-record";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return <main className="content"><Link href="/driver/vehicle-check">Back to Vehicle check</Link>{id?<VehicleCheckRecord id={id} apiBase="/api/driver/vehicle"/>:<p>Choose a check to view.</p>}</main>}
