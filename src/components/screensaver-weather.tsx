"use client";

import React, { useEffect, useState } from "react";
import { CloudSun } from "lucide-react";
import type { CurrentWeather } from "@/lib/weather";

const RETRY_DELAYS_MS = [30_000, 120_000, 300_000] as const;
const REFRESH_MS = 15 * 60 * 1000;

type WeatherView = CurrentWeather & { stale: boolean };

export function ScreensaverWeatherContent({ weather }: { weather: WeatherView }) {
  return (
    <aside className="idle-weather" aria-label={`Current weather for ${weather.location}`}>
      <CloudSun aria-hidden="true"/>
      <div>
        <strong>{weather.temperature}°C</strong>
        <span>{weather.condition}</span>
        <small>{weather.location} · Feels like {weather.feelsLike}°C{weather.stale ? " · Cached" : ""}</small>
      </div>
    </aside>
  );
}
export function ScreensaverWeather({ enabled, location }: { enabled: boolean; location: string }) {
  const cacheKey = `stars-connect-current-weather:${location.toLocaleLowerCase("en-GB")}`;
  const [weather, setWeather] = useState<WeatherView | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setWeather(null);
      setUnavailable(false);
      return;
    }

    let mounted = true;
    let timer: number | undefined;
    let retry = 0;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as CurrentWeather | null;
      if (cached) setWeather({ ...cached, stale: true });
    } catch {
      localStorage.removeItem(cacheKey);
    }

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(load, delay);
    };
    const load = async () => {
      const id = localStorage.getItem("pulse-device-id");
      const token = localStorage.getItem("pulse-device-token");
      if (!id || !token || !navigator.onLine) {
        if (mounted) setUnavailable(true);
        return;
      }
      const response = await fetch("/api/kiosk/weather", {
        headers: { "x-device-id": id, authorization: `Bearer ${token}` },
        cache: "no-store",
      }).catch(() => null);
      if (!mounted) return;
      if (response?.status === 204) {
        setWeather(null);
        setUnavailable(false);
        return;
      }
      if (response?.ok) {
        const body = await response.json();
        if (body.weather) {
          setWeather({ ...body.weather, stale: body.stale === true });
          setUnavailable(false);
          localStorage.setItem(cacheKey, JSON.stringify(body.weather));
          retry = 0;
          schedule(REFRESH_MS);
        }
        return;
      }
      if (response?.status === 503 || response === null) {
        setUnavailable(true);
        if (retry < RETRY_DELAYS_MS.length) schedule(RETRY_DELAYS_MS[retry++]);
        return;
      }
      setUnavailable(true);
    };

    void load();
    const online = () => {
      retry = 0;
      void load();
    };
    addEventListener("online", online);
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      removeEventListener("online", online);
    };
  }, [cacheKey, enabled]);

  if (!enabled) return null;
  if (!weather) {
    return unavailable
      ? <aside className="idle-weather unavailable" aria-live="polite"><CloudSun aria-hidden="true"/><span>Weather temporarily unavailable</span></aside>
      : null;
  }
  return <ScreensaverWeatherContent weather={weather}/>;
}

