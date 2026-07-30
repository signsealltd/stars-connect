"use client";

export type SeasonalScene = "halloween" | "christmas" | "st-patricks";

export function SeasonalScreensaverArt({ scene }: { scene: SeasonalScene }) {
  if (scene === "halloween") {
    return <svg className="seasonal-scene halloween-scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="pumpkinGlow"><stop stopColor="#ffd45c"/><stop offset="1" stopColor="#ef781e"/></radialGradient>
        <linearGradient id="nightSky" x2="0" y2="1"><stop stopColor="#100720"/><stop offset="1" stopColor="#351148"/></linearGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#nightSky)"/>
      <circle className="halloween-moon" cx="935" cy="130" r="72" fill="#fff0bd"/>
      <path className="halloween-cloud" d="M760 165c50-43 89-24 104 7 55-35 118-8 125 34H735c1-18 9-32 25-41Z" fill="#1c1430" opacity=".78"/>
      <path d="M0 570Q170 500 360 560T760 545T1200 555V700H0Z" fill="#09070e"/>
      <g className="haunted-house" fill="#09070e" stroke="#5e3a72" strokeWidth="5">
        <path d="M745 500V295l82-72 68 62v-96h55v146l83 70v95Z"/>
        <path d="m707 315 126-112 69 62 18-20 146 137" fill="none" strokeLinecap="round"/>
        <path d="M813 500v-94h69v94M940 364h49v62h-49zM774 333h42v55h-42z"/>
      </g>
      <g className="house-windows" fill="#ffb52f"><path d="M782 342h25v37h-25zM950 374h29v42h-29z"/><path d="M823 416h49v84h-49z"/></g>
      <g className="pumpkin" transform="translate(165 425)">
        <ellipse cx="150" cy="110" rx="145" ry="106" fill="url(#pumpkinGlow)" stroke="#b74b16" strokeWidth="10"/>
        <path d="M150 18c-18-41 0-65 30-81" fill="none" stroke="#4b772d" strokeWidth="17" strokeLinecap="round"/>
        <path d="M64 80l45-26-13 49ZM236 80l-45-26 13 49ZM76 139q74 70 148 0-28 25-49 7l-25 28-25-28q-24 18-49-7Z" fill="#351148"/>
        <path d="M150 12c-46 12-59 188 0 204M150 12c46 12 59 188 0 204" fill="none" stroke="#c75a19" strokeWidth="6" opacity=".75"/>
        <ellipse className="pumpkin-candle-glow" cx="150" cy="112" rx="132" ry="94" fill="#ffd56a" opacity=".13"/>
      </g>
      <g className="bats" fill="#0a0710"><path d="M505 145q28-34 56 0 28-34 56 0-27-17-56 14-29-31-56-14Z"/><path d="M650 95q20-25 40 0 20-25 40 0-20-12-40 11-20-23-40-11Z"/></g>
    </svg>;
  }
  if (scene === "christmas") {
    const bulbs = [
      [70,55,"#f04b4b"],[170,72,"#52ce74"],[275,60,"#ffd65a"],[380,77,"#55b8ff"],[490,58,"#f04b4b"],[600,76,"#52ce74"],[710,58,"#ffd65a"],[820,76,"#55b8ff"],[930,58,"#f04b4b"],[1040,72,"#52ce74"],[1130,54,"#ffd65a"],
    ];
    return <svg className="seasonal-scene christmas-scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="winterSky" x2="0" y2="1"><stop stopColor="#071b2c"/><stop offset="1" stopColor="#12372f"/></linearGradient></defs>
      <rect width="1200" height="700" fill="url(#winterSky)"/>
      <path d="M0 585q155-90 320-10t330-7 350 5 200-20v147H0Z" fill="#f5fbff"/>
      <path d="M0 36q300 68 600 18t600-12" fill="none" stroke="#183126" strokeWidth="8"/>
      {bulbs.map(([x,y,color],index)=><g className="christmas-bulb" style={{animationDelay:`${index*.16}s`}} key={String(x)}>
        <path d={`M${x} ${Number(y)-17}v18`} stroke="#263d2c" strokeWidth="8"/>
        <rect x={Number(x)-11} y={Number(y)-3} width="22" height="15" rx="4" fill="#344b38"/>
        <ellipse cx={x} cy={Number(y)+27} rx="19" ry="27" fill={String(color)}/>
      </g>)}
      <g className="christmas-tree" transform="translate(855 230)">
        <path d="m120 0 22 47 52 7-38 36 10 52-46-25-47 25 10-52-38-36 52-7Z" fill="#ffd75b"/>
        <path d="M120 47 15 230h62L0 360h240l-77-130h62Z" fill="#1c8f54"/>
        <path d="M100 360h40v82h-40z" fill="#704526"/>
        <path d="M32 306q88 45 176 0M50 235q70 37 140 0M73 166q47 24 94 0" fill="none" stroke="#e7c957" strokeWidth="10"/>
        <circle cx="79" cy="203" r="10" fill="#ef4e4e"/><circle cx="160" cy="283" r="10" fill="#55b8ff"/><circle cx="116" cy="331" r="10" fill="#ef4e4e"/>
      </g>
      <g className="snowflakes" fill="#fff"><circle cx="110" cy="180" r="5"/><circle cx="280" cy="260" r="7"/><circle cx="495" cy="160" r="5"/><circle cx="680" cy="300" r="7"/><circle cx="770" cy="155" r="5"/><circle cx="1060" cy="210" r="6"/></g>
    </svg>;
  }
  return <svg className="seasonal-scene patricks-scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="greenSky" x2="0" y2="1"><stop stopColor="#06291c"/><stop offset="1" stopColor="#0e6841"/></linearGradient></defs>
    <rect width="1200" height="700" fill="url(#greenSky)"/>
    <path d="M0 575q180-90 350-10t360 0 320 0 170-20v155H0Z" fill="#164f31"/>
    <path className="rainbow" d="M60 580Q320 155 630 440" fill="none" stroke="#e74c4c" strokeWidth="62"/>
    <path d="M60 580Q320 175 630 440" fill="none" stroke="#f2a93b" strokeWidth="45"/>
    <path d="M60 580Q320 195 630 440" fill="none" stroke="#f3dc55" strokeWidth="29"/>
    <path d="M60 580Q320 215 630 440" fill="none" stroke="#55b8ff" strokeWidth="14"/>
    <g className="leprechaun" transform="translate(760 170)">
      <circle cx="160" cy="192" r="92" fill="#ffd1a3"/>
      <path d="M72 180q88-145 176 0l-25 105q-63 88-126 0Z" fill="#d96d27"/>
      <path d="M80 130h160v43H80zM105 35h110l27 105H78Z" fill="#168449" stroke="#093b26" strokeWidth="8"/>
      <rect x="118" y="88" width="84" height="30" rx="5" fill="#231d16"/><rect x="144" y="84" width="32" height="38" fill="#f7d556"/>
      <circle cx="128" cy="191" r="8" fill="#17221b"/><circle cx="192" cy="191" r="8" fill="#17221b"/>
      <path d="M137 228q23 18 46 0" fill="none" stroke="#8c4423" strokeWidth="7" strokeLinecap="round"/>
      <path d="M110 286 52 400h216l-58-114Z" fill="#168449"/><path d="M126 283h68l-34 42Z" fill="#f7d556"/>
      <path d="M96 393 65 510M224 393l31 117" stroke="#171c19" strokeWidth="27" strokeLinecap="round"/>
      <path d="M45 510h76M199 510h76" stroke="#171c19" strokeWidth="34" strokeLinecap="round"/>
      <g className="shamrock" transform="translate(245 270)" fill="#5fd278"><circle cx="0" cy="0" r="24"/><circle cx="38" cy="0" r="24"/><circle cx="19" cy="-33" r="24"/><path d="m19 0 12 73H8Z"/></g>
    </g>
    <g className="gold-pot" transform="translate(500 475)"><ellipse cx="100" cy="82" rx="105" ry="36" fill="#111"/><path d="M5 82h190l-28 103H33Z" fill="#161616"/><g fill="#f5cf43"><circle cx="35" cy="65" r="15"/><circle cx="70" cy="52" r="17"/><circle cx="105" cy="61" r="16"/><circle cx="140" cy="49" r="17"/><circle cx="170" cy="67" r="14"/></g></g>
  </svg>;
}
