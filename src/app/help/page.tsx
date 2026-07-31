import{Header}from"@/components/header";import{HelpCentre}from"@/components/help-centre";import{requireRole}from"@/lib/security";
export const metadata={title:"Help Centre"};
export default async function HelpPage(){await requireRole("RECEPTION");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Help Centre</h1><p className="muted">Searchable guidance for everyday STARS Connect tasks. Use Help on any page for guidance about that screen.</p></div></div><HelpCentre/></div></main>}
