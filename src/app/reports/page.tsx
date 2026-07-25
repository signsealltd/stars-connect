import Image from "next/image";
import { Header } from "@/components/header";
import { ReportsClient } from "@/components/reports-client";
export default function Reports(){return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><Image src="/branding/stars-logo.svg" alt="STARS" width={92} height={68}/><h1 className="page-title">Operational reports</h1><p className="muted">Permission-protected attendance reports, CSV exports and print views.</p></div></div><ReportsClient/></div></main>}
