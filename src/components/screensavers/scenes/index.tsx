import type { MonthlyScreensaverId } from "@/lib/screensaver";
import { monthlyScreensaverOptions } from "@/lib/screensaver";
import { JanuaryWinterScene } from "./JanuaryWinterScene";
import { FebruaryHeartsScene } from "./FebruaryHeartsScene";
import { MarchDaffodilsScene } from "./MarchDaffodilsScene";
import { AprilRainshowersScene } from "./AprilRainshowersScene";
import { MayButterfliesScene } from "./MayButterfliesScene";
import { JuneSummerFlowersScene } from "./JuneSummerFlowersScene";
import { JulyBeachScene } from "./JulyBeachScene";
import { AugustFairgroundScene } from "./AugustFairgroundScene";
import { SeptemberWoodlandScene } from "./SeptemberWoodlandScene";
import { OctoberHalloweenScene } from "./OctoberHalloweenScene";
import { NovemberBonfireScene } from "./NovemberBonfireScene";
import { DecemberChristmasScene } from "./DecemberChristmasScene";

const sceneComponents: Record<MonthlyScreensaverId, () => React.JSX.Element> = {
  "january-winter": JanuaryWinterScene,
  "february-hearts": FebruaryHeartsScene,
  "march-daffodils": MarchDaffodilsScene,
  "april-rainshowers": AprilRainshowersScene,
  "may-butterflies": MayButterfliesScene,
  "june-summer-flowers": JuneSummerFlowersScene,
  "july-beach": JulyBeachScene,
  "august-fairground": AugustFairgroundScene,
  "september-woodland": SeptemberWoodlandScene,
  "october-halloween": OctoberHalloweenScene,
  "november-bonfire": NovemberBonfireScene,
  "december-christmas": DecemberChristmasScene,
};

export function MonthlyScreensaverScene({ scene }: { scene: MonthlyScreensaverId }) {
  const Scene = sceneComponents[scene];
  return <Scene/>;
}

function motif(scene: MonthlyScreensaverId) {
  if (scene.includes("winter") || scene.includes("christmas")) return <g fill="#fff">{[35,72,112,150,184].map((x,i)=><circle key={x} cx={x} cy={25+i%2*22} r="3"/>)}</g>;
  if (scene.includes("hearts")) return <path d="M100 72C55 30 40 95 100 135c60-40 45-105 0-63Z" fill="#ff8197"/>;
  if (scene.includes("rain")) return <><path d="M25 130Q100 15 185 125" fill="none" stroke="#f4cc68" strokeWidth="12"/><g stroke="#d9f1ff" strokeWidth="4">{[45,80,120,155].map(x=><path key={x} d={`M${x} 45l-12 35`}/>)}</g></>;
  if (scene.includes("fairground")) return <g fill="none" stroke="#ffd36c" strokeWidth="5"><circle cx="100" cy="90" r="50"/><path d="M100 40v100M50 90h100M100 90 65 55M100 90l35-35"/></g>;
  if (scene.includes("halloween")) return <g><circle cx="100" cy="90" r="47" fill="#ec842f"/><path d="m72 82 18-10-6 22m44-12-18-10 6 22m-40 22q24 19 48 0" fill="none" stroke="#391927" strokeWidth="8"/></g>;
  if (scene.includes("bonfire")) return <path d="M100 145C30 85 105 52 92 5c80 64 75 117 8 140Z" fill="#ff9a35"/>;
  if (scene.includes("beach")) return <><path d="M0 90q55-20 110 0t110 0v45H0Z" fill="#64bdd2"/><path d="m145 40 25 30-25 30-25-30Z" fill="#e95e63"/></>;
  return <g fill="#ffd74a">{[45,75,105,135,165].map((x,i)=><circle key={x} cx={x} cy={105+(i%2)*20} r="18"/>)}</g>;
}

export function MonthlySceneThumbnail({ scene }: { scene: MonthlyScreensaverId }) {
  const option = monthlyScreensaverOptions.find(item => item.id === scene)!;
  return <svg className="monthly-scene-thumbnail" viewBox="0 0 200 140" aria-hidden="true" focusable="false"><defs><linearGradient id={`thumb-${scene}`} x2="0" y2="1"><stop stopColor={option.palette}/><stop offset="1" stopColor="#172138"/></linearGradient></defs><rect width="200" height="140" rx="12" fill={`url(#thumb-${scene})`}/><path d="M0 105q45-35 95 0t105-8v43H0Z" fill="#4f7849" opacity=".82"/>{motif(scene)}</svg>;
}