import{Header}from"@/components/header";import{UserManager}from"@/components/user-manager";import{requireRole}from"@/lib/security";export const dynamic="force-dynamic";
export default async function UsersPage(){await requireRole("ADMINISTRATOR");return <main className="shell"><Header manager/><div className="content"><UserManager/></div></main>}
