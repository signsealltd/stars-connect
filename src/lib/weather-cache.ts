import type { CurrentWeather } from "./weather";

const weatherCache = new Map<string, { expiresAt: number; weather: CurrentWeather }>();

export function readWeatherCache(key: string) {
  return weatherCache.get(key);
}

export function writeWeatherCache(key: string, expiresAt: number, weather: CurrentWeather) {
  weatherCache.set(key, { expiresAt, weather });
}

export function clearWeatherCacheForTesting() {
  weatherCache.clear();
}
