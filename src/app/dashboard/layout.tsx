import{requireRole}from"@/lib/security";
export default async function DashboardLayout({children}:{children:React.ReactNode}){await requireRole("RECEPTION");return children}