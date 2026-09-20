"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";


function applyBranding(branding: Record<string, string>) {
  const root = document.documentElement;
  root.style.setProperty("--primary", branding.themePrimary);
  root.style.setProperty("--primary-dark", branding.themePrimaryDark);
  root.style.setProperty("--primary-strong", branding.themePrimaryDark);
  root.style.setProperty("--info", branding.themeAccent);
}

export function AppearanceController() {
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/branding").then((response) => response.json()).then((branding) => {
      applyBranding(branding);
      window.dispatchEvent(new CustomEvent("stars-branding", { detail: branding }));
    }).catch(() => undefined);
    document.documentElement.dataset.theme = "light";
    const updateBranding = (event: Event) => applyBranding((event as CustomEvent).detail);
    window.addEventListener("stars-branding", updateBranding);
    return () => {
      window.removeEventListener("stars-branding", updateBranding);
    };
  }, [pathname]);
  return null;
}
