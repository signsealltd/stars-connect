import type { ReactNode } from "react";

export function SceneFrame({ id, sky, horizon, ground, children }: { id: string; sky: [string,string]; horizon: string; ground: string; children: ReactNode }) {
  return <svg className={`monthly-scene scene-${id}`} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={sky[0]}/><stop offset="1" stopColor={sky[1]}/></linearGradient>
      <linearGradient id={`${id}-ground`} x2="0" y2="1"><stop stopColor={horizon}/><stop offset="1" stopColor={ground}/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#fffbd4" stopOpacity=".88"/><stop offset="1" stopColor="#fffbd4" stopOpacity="0"/></radialGradient><radialGradient id="scene-centre-vignette"><stop offset="0" stopColor="#000" stopOpacity=".2"/><stop offset=".48" stopColor="#000" stopOpacity=".04"/><stop offset="1" stopColor="#000" stopOpacity=".22"/></radialGradient>
    </defs>
    <rect width="1600" height="1000" fill={`url(#${id}-sky)`}/>
    <circle className="scene-sun-glow" cx="800" cy="275" r="250" fill={`url(#${id}-glow)`}/>
    <path className="scene-cloud cloud-one" d="M80 235c45-58 103-42 127 4 72-57 166-8 160 57H30c3-29 21-51 50-61Z" fill="#fff" opacity=".33"/>
    <path className="scene-cloud cloud-two" d="M1160 155c40-50 92-36 113 5 65-51 147-8 143 51h-302c2-25 19-45 46-56Z" fill="#fff" opacity=".24"/>
    <path d="M0 650Q180 520 390 620t410-10q220-115 410 12t390-30v408H0Z" fill={`url(#${id}-ground)`}/>
    <path d="M0 765q220-90 430 3t390-10 370 9 410-33v266H0Z" fill={ground} opacity=".94"/>
    {children}
    <rect className="scene-readable-vignette" width="1600" height="1000" fill="url(#scene-centre-vignette)"/>
  </svg>;
}

export function Cottage({ x, y, scale=1, colour="#f4e3ca", roof="#59374c" }: { x:number;y:number;scale?:number;colour?:string;roof?:string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className="scene-cottage"><path d="M0 115 105 28l105 87v150H0Z" fill={colour}/><path d="m-18 118 123-103 123 103-25 18-98-80-98 80Z" fill={roof}/><rect x="82" y="170" width="48" height="95" rx="4" fill="#6b4638"/><g className="window-glow" fill="#ffd879"><rect x="25" y="135" width="42" height="45" rx="4"/><rect x="145" y="135" width="42" height="45" rx="4"/></g><path className="chimney-smoke" d="M166 35q-45-32-3-70t-7-66" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth="17" strokeLinecap="round"/></g>;
}
export function Tree({ x,y,scale=1,leaf="#466f42",trunk="#66432f" }: {x:number;y:number;scale?:number;leaf?:string;trunk?:string}) {return <g className="scene-tree" transform={`translate(${x} ${y}) scale(${scale})`}><path d="M105 310q-6-130 0-255M104 165 42 92M105 130l70-73" fill="none" stroke={trunk} strokeWidth="27" strokeLinecap="round"/><g className="tree-crown" fill={leaf}><circle cx="70" cy="75" r="70"/><circle cx="145" cy="62" r="76"/><circle cx="110" cy="10" r="70"/><circle cx="35" cy="22" r="55"/></g></g>}
export function Flowers({ y=780, colours=["#ffd83d","#fff4ba","#ec6e86"] }: {y?:number;colours?:string[]}) {return <g className="scene-flowers">{Array.from({length:16},(_,i)=>{const x=40+i*104, h=55+(i%4)*22,c=colours[i%colours.length];return <g key={x} transform={`translate(${x} ${y-h})`}><path d={`M0 ${h}Q${i%2?12:-12} ${h/2} 0 0`} fill="none" stroke="#397843" strokeWidth="7"/><g className="flower-head"><circle r="19" fill={c}/><circle r="7" fill="#7b5725"/></g></g>})}</g>}
export function Snowfall(){return <g className="scene-particles snow-particles" fill="#fff">{Array.from({length:30},(_,i)=><circle key={i} cx={(i*173)%1570+15} cy={(i*89)%760+20} r={2+(i%4)} style={{animationDelay:`-${i*.43}s`}}/>)}</g>}
export function Rainfall(){return <g className="scene-particles rain-particles" stroke="#d8edff" strokeWidth="5" strokeLinecap="round">{Array.from({length:24},(_,i)=><path key={i} d={`M${(i*137)%1580} ${(i*83)%640}l-24 62`} style={{animationDelay:`-${i*.19}s`}}/>)}</g>}
export function Birds({ x=1120,y=180 }: {x?:number;y?:number}){return <g className="scene-birds" transform={`translate(${x} ${y})`} fill="none" stroke="#263746" strokeWidth="7" strokeLinecap="round"><path d="M0 20q22-25 44 0 22-25 44 0M110 0q18-21 36 0 18-21 36 0"/></g>}
export function Butterfly({x,y,colour="#ef7048",delay=0}:{x:number;y:number;colour?:string;delay?:number}){return <g className="scene-butterfly" style={{animationDelay:`-${delay}s`}} transform={`translate(${x} ${y})`}><ellipse cx="-15" cy="-8" rx="20" ry="28" fill={colour}/><ellipse cx="15" cy="-8" rx="20" ry="28" fill={colour}/><rect x="-3" y="-20" width="6" height="40" rx="3" fill="#422d39"/></g>}
export function Festoon(){return <g className="scene-festoon"><path d="M0 80q400 120 800 0t800 0" fill="none" stroke="#261b2c" strokeWidth="8"/>{Array.from({length:17},(_,i)=>{const x=i*100,y=80+Math.sin(i*Math.PI/4)*38;return <g className="festoon-light" key={i} style={{animationDelay:`-${i*.17}s`}}><path d={`M${x} ${y}v28`} stroke="#2e2632" strokeWidth="7"/><circle cx={x} cy={y+39} r="13" fill={i%2?"#ffd460":"#ff8a57"}/></g>})}</g>}