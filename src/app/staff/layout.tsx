import type {Metadata} from "next";
import "./staff.css";
export const metadata:Metadata={title:"STARS Staff",applicationName:"STARS Staff",manifest:"/staff/manifest.webmanifest",appleWebApp:{capable:true,title:"STARS Staff",statusBarStyle:"black-translucent"},icons:{apple:"/staff/icon-192.png"}};
export default function StaffLayout({children}:{children:React.ReactNode}){return children}
