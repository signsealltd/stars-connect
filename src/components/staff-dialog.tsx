"use client";
import {useEffect,useRef} from "react";
export function StaffDialog({children,label,onClose,management=false}:{children:React.ReactNode;label:string;onClose:()=>void;management?:boolean}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);return <dialog ref={ref} className={management?"modal":"staff-dialog"} style={management?{margin:"auto",border:"1px solid #e4d6ec",width:"min(620px,calc(100% - 32px))"}:undefined} aria-label={label} onCancel={e=>{e.preventDefault();onClose()}}>{children}</dialog>}
