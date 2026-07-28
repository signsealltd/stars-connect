import { Header } from "@/components/header";
import { ClockingPhotoReview, type ClockingPhotoRow } from "@/components/clocking-photo-review";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/security";
import { localDateKey, localDayBounds } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Search = Promise<{ from?: string; to?: string; staff?: string; device?: string }>;
const validDate = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

export default async function ClockingPhotosPage({ searchParams }: { searchParams: Search }) {
  await requireRole("DIRECTOR");
  const params = await searchParams;
  const today = localDateKey();
  const weekAgo = localDateKey(new Date(Date.now() - 6 * 86_400_000));
  const from = validDate(params.from) || weekAgo;
  const to = validDate(params.to) || today;
  const boundsFrom = localDayBounds(from).start;
  const boundsTo = localDayBounds(to).end;

  const [events, staff, devices] = await Promise.all([
    prisma.clockEvent.findMany({
      where: {
        deviceTimestamp: { gte: boundsFrom, lte: boundsTo },
        photoStatus: { not: "NOT_REQUIRED" },
        ...(params.staff ? { staffId: params.staff } : {}),
        ...(params.device ? { deviceId: params.device } : {}),
      },
      include: {
        staff: { select: { displayName: true } },
        device: { select: { name: true } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { deviceTimestamp: "desc" },
      take: 500,
    }),
    prisma.staffMember.findMany({ where: { active: true }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    prisma.device.findMany({ where: { isSeedData: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const now = new Date();
  const rows: ClockingPhotoRow[] = events.map(event => {
    const photo = event.photos[0];
    return {
      eventId: event.id,
      photoId: photo?.id || null,
      staffName: event.staff.displayName,
      deviceName: event.device.name,
      eventType: event.type,
      eventTime: event.deviceTimestamp.toISOString(),
      photoStatus: event.photoStatus,
      expiresAt: photo?.expiresAt.toISOString() || null,
      retained: Boolean(photo && !photo.deletedAt && photo.expiresAt > now),
    };
  });

  return <main className="shell"><Header manager/><div className="content">
    <div className="page-head"><div><h1 className="page-title">Clocking photographs</h1><p className="muted">Review front-camera confirmation images for staff PIN clocking events. Photograph access is audited.</p></div></div>
    <form className="card photo-filter" method="get">
      <label className="form-label">From<input className="field" type="date" name="from" defaultValue={from}/></label>
      <label className="form-label">To<input className="field" type="date" name="to" defaultValue={to}/></label>
      <label className="form-label">Staff member<select className="field" name="staff" defaultValue={params.staff || ""}><option value="">All staff</option>{staff.map(row => <option value={row.id} key={row.id}>{row.displayName}</option>)}</select></label>
      <label className="form-label">Device<select className="field" name="device" defaultValue={params.device || ""}><option value="">All devices</option>{devices.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
      <button className="btn primary">Apply filters</button>
      <a className="btn secondary" href="/dashboard/reports/clocking-photos">Reset</a>
    </form>
    <div className="alert alert-warning" style={{ marginBottom: 18 }}>Photographs contain personal data. View them only for an authorised attendance or safeguarding purpose.</div>
    <ClockingPhotoReview rows={rows}/>
  </div></main>;
}
