"use client";

import { useEffect } from "react";

function applyBranding(branding: Record<string, string>) {
  const root = document.documentElement;
  root.style.setProperty("--primary", branding.themePrimary);
  root.style.setProperty("--primary-dark", branding.themePrimaryDark);
  root.style.setProperty("--primary-strong", branding.themePrimaryDark);
  root.style.setProperty("--info", branding.themeAccent);
}

function applyMode(mode: string) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function AppearanceController() {
  useEffect(() => {
    fetch("/api/branding").then((response) => response.json()).then((branding) => {
      applyBranding(branding);
      window.dispatchEvent(new CustomEvent("stars-branding", { detail: branding }));
    }).catch(() => undefined);
    fetch("/api/preferences").then((response) => response.ok ? response.json() : null).then((preferences) => {
      if (preferences) applyMode(preferences.colourMode);
    }).catch(() => undefined);
    const update = (event: Event) => applyMode((event as CustomEvent).detail);
    const updateBranding = (event: Event) => applyBranding((event as CustomEvent).detail);
    window.addEventListener("stars-colour-mode", update);
    window.addEventListener("stars-branding", updateBranding);
    return () => {
      window.removeEventListener("stars-colour-mode", update);
      window.removeEventListener("stars-branding", updateBranding);
    };
  }, []);
  return null;
}
