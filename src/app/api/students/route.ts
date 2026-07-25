import{NextResponse}from"next/server";import{prisma}from"@/lib/prisma";
export async function GET(){const rows=await prisma.student.findMany({where:{active:true},select:{id:true,displayName:true,expectedDays:true,profilePhotoUrl:true},orderBy:{displayName:"asc"}});return NextResponse.json(rows)}
