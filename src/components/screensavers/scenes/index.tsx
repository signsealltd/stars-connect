import type { MonthlyScreensaverId } from "@/lib/screensaver";
import { TwinklingStarsScene,TwinklingStarsThumbnail } from "./TwinklingStarsScene";
// All monthly choices intentionally render this shared placeholder until final layered artwork is supplied.
export function MonthlyScreensaverScene({ scene }: { scene: MonthlyScreensaverId }) {return <TwinklingStarsScene key={scene}/> }
export function MonthlySceneThumbnail({ scene }: { scene: MonthlyScreensaverId }) {return <TwinklingStarsThumbnail key={scene}/> }
