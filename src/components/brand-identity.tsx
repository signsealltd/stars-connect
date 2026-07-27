/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function BrandIdentity({ manager = false }: { manager?: boolean }) {
  const [branding, setBranding] = useState({ organisationName: "STARS Day Service", organisationLogoUrl: "/branding/stars-logo.svg" });
  useEffect(() => {
    fetch("/api/branding").then((response) => response.json()).then(setBranding).catch(() => undefined);
    const update = (event: Event) => setBranding((current) => ({ ...current, ...(event as CustomEvent).detail }));
    window.addEventListener("stars-branding", update);
    return () => window.removeEventListener("stars-branding", update);
  }, []);
  return <Link href={manager ? "/dashboard" : "/"} className="brand" aria-label="STARS Connect home">
    <img src={branding.organisationLogoUrl || "/branding/stars-logo.svg"} alt="" className="brand-logo"/>
    <span className="brand-copy">STARS Connect<small>{manager ? branding.organisationName : "Attendance and Register Management"}</small></span>
  </Link>;
}

export function OrganisationName() {
  const [name, setName] = useState("STARS Day Service");
  useEffect(() => {
    fetch("/api/branding").then((response) => response.json()).then((value) => setName(value.organisationName)).catch(() => undefined);
    const update = (event: Event) => { const next = (event as CustomEvent).detail?.organisationName; if (next) setName(next); };
    window.addEventListener("stars-branding", update);
    return () => window.removeEventListener("stars-branding", update);
  }, []);
  return <span className="organisation-name">{name}</span>;
}