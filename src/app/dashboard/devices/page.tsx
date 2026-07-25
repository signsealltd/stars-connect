import { Header } from "@/components/header";
import { DeviceManager } from "@/components/device-manager";
export default function DevicesPage(){return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Devices</h1><p className="muted">Provision, monitor, rotate and revoke authorised tablets.</p></div></div><DeviceManager/></div></main>}
