import nodemailer from "nodemailer";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { formatUkDate, formatUkTime, localDateAsDatabaseDate, localDateKey } from "./dates";
import { siteSummary } from "./reports";

function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("SMTP is not configured");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
}

export async function buildDailySummary(date = localDateKey()) {
  const summary = await siteSummary(date);
  const appUrl = process.env.APP_URL || "https://app.starsconnect.co.uk";
  const staffRows = summary.staff.map((s) => `${s.staffMember}: ${s.firstClockIn ? formatUkTime(s.firstClockIn) : "—"}–${s.finalClockOut ? formatUkTime(s.finalClockOut) : "still in"}`);
  const issueCount = summary.staffStillIn + summary.studentsUnconfirmed + summary.conflicts;
  const text = [
    "STARS Connect — Daily attendance summary", formatUkDate(`${date}T12:00:00Z`, "EEEE d MMMM yyyy"), "",
    `Staff attended: ${summary.staffAttended}`, `Staff still clocked in: ${summary.staffStillIn}`,
    ...staffRows, "", `Students present: ${summary.studentsPresent}`, `Students absent: ${summary.studentsAbsent}`,
    `Students late: ${summary.studentsLate}`, `Students unconfirmed: ${summary.studentsUnconfirmed}`,
    `Unresolved sync conflicts: ${summary.conflicts}`, `Stale or revoked devices: ${summary.staleOrRevokedDevices}`,
    `Records requiring attention: ${issueCount}`, "", `Open STARS Connect: ${appUrl}/dashboard`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4f8;font-family:Arial,sans-serif;color:#211d23"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="640" style="max-width:100%;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#54205d;padding:22px;color:#fff"><img src="${appUrl}/branding/stars-logo.svg" alt="STARS" width="90" style="display:block;margin-bottom:12px"><h1 style="margin:0">STARS Connect</h1><div>Daily attendance summary</div></td></tr><tr><td style="padding:24px"><h2>${formatUkDate(`${date}T12:00:00Z`, "EEEE d MMMM yyyy")}</h2><h3>Staff</h3><p>Attended: <b>${summary.staffAttended}</b> &nbsp; Still clocked in: <b>${summary.staffStillIn}</b></p><ul>${staffRows.map((r)=>`<li>${r}</li>`).join("")}</ul><h3>Students</h3><p>Present: <b>${summary.studentsPresent}</b> &nbsp; Absent: <b>${summary.studentsAbsent}</b> &nbsp; Late: <b>${summary.studentsLate}</b> &nbsp; Unconfirmed: <b>${summary.studentsUnconfirmed}</b></p><h3>Review</h3><p>Sync conflicts: <b>${summary.conflicts}</b><br>Stale/revoked devices: <b>${summary.staleOrRevokedDevices}</b></p><p><a href="${appUrl}/dashboard" style="display:inline-block;background:#82368c;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px">Open manager dashboard</a></p><p style="font-size:12px;color:#6f6872">Attendance photographs are never included in summary emails.</p></td></tr></table></td></tr></table></body></html>`;
  return { summary, text, html };
}

export async function getEmailSettings() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ["dailyEmailEnabled","dailyEmailTime","dailyEmailRecipients"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.dailyEmailEnabled === true,
    time: typeof map.dailyEmailTime === "string" ? map.dailyEmailTime : "17:30",
    recipients: Array.isArray(map.dailyEmailRecipients) ? map.dailyEmailRecipients.map(String) : [],
  };
}

export async function sendDailySummary(options: { date?:string;recipients?:string[];triggeredBy:string;userId?:string }) {
  const date = options.date || localDateKey();
  const settings = await getEmailSettings();
  const recipients = options.recipients || settings.recipients;
  if (!recipients.length) throw new Error("No summary recipients are configured");
  const record = await prisma.dailySummaryEmail.create({
    data: { date: localDateAsDatabaseDate(date), recipients: recipients as Prisma.InputJsonValue, status:"PENDING", triggeredBy:options.triggeredBy, triggeredByUserId:options.userId },
  });
  try {
    const content = await buildDailySummary(date);
    await transport().sendMail({
      from: process.env.SMTP_FROM,
      to: recipients,
      subject: `STARS Connect daily attendance summary — ${formatUkDate(`${date}T12:00:00Z`)}`,
      text: content.text,
      html: content.html,
    });
    return await prisma.dailySummaryEmail.update({ where:{id:record.id}, data:{status:"SENT",sentAt:new Date()} });
  } catch (error) {
    await prisma.dailySummaryEmail.update({ where:{id:record.id}, data:{status:"FAILED",failureReason:error instanceof Error?error.message:"Email failed",retryCount:{increment:1}} });
    throw error;
  }
}
