"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import { hasDeviceCredential, isKioskRoute } from "@/lib/kiosk-context";

export function ApplicationVersion() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    if (isKioskRoute(pathname) && hasDeviceCredential(localStorage)) setAuthenticated(true);
    else fetch("/api/auth/me", { cache: "no-store", signal: controller.signal })
      .then(response => setAuthenticated(response.ok))
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  const visible = !pathname.startsWith("/staff/") && pathname!=="/staff" && authenticated && pathname !== "/login" && pathname !== "/setup" && !pathname.startsWith("/information-review/");
  useEffect(() => {
    document.body.classList.toggle("has-app-version", visible);
    return () => document.body.classList.remove("has-app-version");
  }, [visible]);
  return visible ? <span className="application-version no-print" tabIndex={0} title={`STARS Connect ${APP_VERSION_LABEL}`} aria-label={`STARS Connect ${APP_VERSION_LABEL}`}>{APP_VERSION_LABEL}</span> : null;
}
