import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = { title:{default:"Pulse",template:"%s · Pulse"}, description:"Attendance and Register Management", manifest:"/manifest.webmanifest", appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Pulse"} };
export const viewport: Viewport = { themeColor:"#14231f", width:"device-width", initialScale:1, viewportFit:"cover" };

export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en-GB"><body><ServiceWorkerRegistration/>{children}</body></html>;
}
