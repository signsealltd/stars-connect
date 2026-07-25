import Image from "next/image";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Header } from "@/components/header";
export default function Offline(){return <main className="shell"><Header/><div className="content" style={{textAlign:"center",paddingTop:55}}><Image src="/branding/stars-logo.svg" alt="STARS" width={160} height={118}/><WifiOff size={58} color="var(--warning)" style={{margin:"15px auto"}}/><h1 className="page-title">STARS Connect is offline</h1><p className="muted">The kiosk, locally cached register and emergency tools remain available. Changes will queue safely for synchronisation.</p><div style={{display:"flex",gap:10,justifyContent:"center",marginTop:24}}><Link className="btn primary" href="/">Kiosk home</Link><Link className="btn danger-solid" href="/emergency">Emergency register</Link></div></div></main>}
