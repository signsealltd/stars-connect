import {VehicleCheckRecord} from "@/components/vehicle-check-record";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return <main className="content"><a href="/VehicleCheck">Vehicle checks</a>{id?<VehicleCheckRecord id={id}/>:<p>Select a check.</p>}</main>}
