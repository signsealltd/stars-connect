import type {Metadata} from "next";
export const metadata:Metadata={title:"My Day",manifest:"/myday/manifest.webmanifest",appleWebApp:{capable:true,title:"My Day",statusBarStyle:"black-translucent"}};
export default function Layout({children}:{children:React.ReactNode}){return children;}
