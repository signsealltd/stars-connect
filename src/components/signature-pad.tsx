"use client";
import { useEffect,useRef,useState } from "react";
import { appendSignatureStroke, type SignatureStrokeData } from "@/lib/visitors";

export function SignaturePad({value,onChange}:{value:SignatureStrokeData;onChange:(value:SignatureStrokeData)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),active=useRef<{x:number;y:number;t:number}[]|null>(null),base=useRef<SignatureStrokeData>([]),pointerId=useRef<number|null>(null),[error,setError]=useState("");
 function draw(){const c=canvas.current;if(!c)return;const rect=c.getBoundingClientRect(),ratio=devicePixelRatio||1;c.width=Math.max(1,Math.round(rect.width*ratio));c.height=Math.max(1,Math.round(rect.height*ratio));const x=c.getContext("2d")!;x.scale(ratio,ratio);x.lineWidth=3;x.lineCap="round";x.lineJoin="round";x.strokeStyle="#321838";x.clearRect(0,0,rect.width,rect.height);for(const stroke of value){x.beginPath();stroke.forEach((p,i)=>{const px=p.x*rect.width,py=p.y*rect.height;if(i)x.lineTo(px,py);else x.moveTo(px,py)});x.stroke()}}
 // draw intentionally depends on the latest value during each render.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{draw();const observer=new ResizeObserver(draw);if(canvas.current)observer.observe(canvas.current);return()=>observer.disconnect()},[value]);
 function point(e:React.PointerEvent){const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),t:Date.now()}}
 function start(e:React.PointerEvent<HTMLCanvasElement>){if(active.current)return;pointerId.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);base.current=value;active.current=[point(e)];setError("")}
 function move(e:React.PointerEvent<HTMLCanvasElement>){if(!active.current||pointerId.current!==e.pointerId)return;active.current.push(point(e));onChange(appendSignatureStroke(base.current,active.current));}
 function end(e:React.PointerEvent<HTMLCanvasElement>){if(!active.current||pointerId.current!==e.pointerId)return;if(active.current.length<2)setError("Please draw a signature rather than tapping the box.");active.current=null;pointerId.current=null}
 return <div><canvas ref={canvas} className="signature-pad" aria-label="Signature pad" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/><div className="signature-actions"><button type="button" className="btn secondary" onClick={()=>onChange(value.slice(0,-1))} disabled={!value.length}>Undo</button><button type="button" className="btn ghost" onClick={()=>onChange([])} disabled={!value.length}>Clear</button></div>{error&&<p className="form-error">{error}</p>}</div>
}