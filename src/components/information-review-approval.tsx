"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { appConfirm } from "@/lib/app-dialog";

type Proposal = { id:string; category:string; fieldKey:string; currentValue:unknown; submittedValue:unknown; critical:boolean; status:string; reviewNote?:string };
type Review = { id:string; status:string; expiresAt:string; submittedAt?:string; completedAt?:string; student:{displayName:string;internalReference?:string}; proposals:Proposal[]; submissions:Array<{declarationName:string;declarationCapacity:string;declaredAt:string}> };

const labels:Record<string,string> = {
  payerType:"Who pays?", payerName:"Payer or organisation", email:"Email", phone:"Telephone", address:"Address",
  photography:"Photographs and media", internalCareRecords:"Internal care records", website:"STARS website",
  socialMedia:"Social media", printedMaterials:"Printed brochures and leaflets", newslettersDisplays:"Newsletters and displays",
  pressReleases:"Press releases", promotionalVideos:"Promotional videos", none:"No photography or media consent",
  localTrips:"Off-site activities", localTripsOther:"Off-site activity details", transport:"STARS transport",
  emergencyTreatment:"Emergency medical treatment", informationSharing:"Information sharing with health professionals",
  conditions:"Medical conditions", allergies:"Allergies", currentMedication:"Current medication",
  emergencyMedication:"Emergency medication", name:"Name", frequency:"How often", dosage:"Dosage",
};
const choices:Record<string,string> = {
  LOCAL_AUTHORITY:"Local authority or council", NHS_OR_HEALTH:"NHS or health organisation",
  FAMILY_OR_REPRESENTATIVE:"Family member or representative", SELF_FUNDED:"Self-funded", OTHER:"Other",
  YES:"Yes", NO:"No", TRUE:"Yes", FALSE:"No",
};
const title = (key:string) => labels[key] || key.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase());
const scalar = (value:unknown) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value);
  if (choices[text]) return choices[text];
  return /^[A-Z][A-Z0-9_]+$/.test(text) ? text.replaceAll("_"," ").toLowerCase().replace(/^./,letter=>letter.toUpperCase()) : text;
};

function ReviewValue({value}:{value:unknown}) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return <span className="review-empty">Not recorded</span>;
  if (Array.isArray(value)) return <div className="review-list">{value.map((item,index)=><div className="review-list-item" key={index}><span className="review-list-number">{index+1}</span><ReviewValue value={item}/></div>)}</div>;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string,unknown>).filter(([,item])=>item !== "" && item != null);
    if (!entries.length) return <span className="review-empty">Not recorded</span>;
    return <dl className="review-details">{entries.map(([key,item])=><div className="review-detail" key={key}><dt>{title(key)}</dt><dd>{typeof item === "object" ? <ReviewValue value={item}/> : scalar(item)}</dd></div>)}</dl>;
  }
  const lines = scalar(value).split(/\r?\n/);
  return <span className="review-text">{lines.map((line,index)=><span key={index}>{line}{index < lines.length-1 && <br/>}</span>)}</span>;
}

export function InformationReviewApproval({id}:{id:string}) {
  const [review,setReview]=useState<Review>(), [error,setError]=useState(""), [busy,setBusy]=useState("");
  const load=useCallback(async()=>{const response=await fetch(`/api/information-reviews/${id}`,{cache:"no-store"}),body=await response.json();if(response.ok)setReview(body);else setError(body.error||"Review could not be loaded.")},[id]);
  useEffect(()=>{void load()},[load]);
  async function action(body:object,key:string){setBusy(key);setError("");const response=await fetch(`/api/information-reviews/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),result=await response.json();if(response.ok)setReview(result);else setError(result.error||"The action could not be completed.");setBusy("")}
  if(!review)return <div className={error?"alert alert-error":"card empty"}>{error||"Loading review…"}</div>;
  const pending=review.proposals.filter(item=>item.status==="PENDING").length;
  return <>
    <div className="page-head"><div><Link href="/dashboard/information-reviews">← Information reviews</Link><h1 className="page-title">{review.student.displayName}</h1><p className="muted">{review.student.internalReference||"No internal reference"} · {review.status.replaceAll("_"," ")}</p></div>{!["COMPLETED","REVOKED"].includes(review.status)&&<button className="btn danger" onClick={async()=>{if(await appConfirm("Revoke this secure review link?"))void action({action:"revoke"},"revoke")}}>Revoke link</button>}</div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="grid stat-grid" style={{marginBottom:18}}><div className="card stat"><span>Proposed changes</span><b>{review.proposals.length}</b></div><div className="card stat"><span>Awaiting decision</span><b>{pending}</b></div><div className="card stat"><span>Critical changes</span><b>{review.proposals.filter(item=>item.critical).length}</b></div><div className="card stat"><span>Expires</span><b style={{fontSize:18}}>{new Date(review.expiresAt).toLocaleDateString("en-GB")}</b></div></div>
    {review.submissions[0]&&<div className="alert alert-warning"><ShieldAlert/>Declared by <b>{review.submissions[0].declarationName}</b> ({review.submissions[0].declarationCapacity}) on {new Date(review.submissions[0].declaredAt).toLocaleString("en-GB")}.</div>}
    <section className="card table-wrap"><table className="table review-comparison"><thead><tr><th>Field</th><th>Current live value</th><th>Submitted value</th><th>Decision</th></tr></thead><tbody>{review.proposals.map(proposal=><tr key={proposal.id}><td><b>{title(proposal.fieldKey)}</b><small className="muted" style={{display:"block"}}>{proposal.category}{proposal.critical?" · Critical confirmation":""}</small></td><td><div className="review-value"><ReviewValue value={proposal.currentValue}/></div></td><td><div className="review-value"><ReviewValue value={proposal.submittedValue}/></div></td><td>{proposal.status==="PENDING"?<div className="table-actions"><button className="btn primary" disabled={!!busy} onClick={()=>void action({action:"proposal",proposalId:proposal.id,decision:"APPROVED"},proposal.id)}><Check/>Accept</button><button className="btn danger" disabled={!!busy} onClick={()=>void action({action:"proposal",proposalId:proposal.id,decision:"REJECTED"},proposal.id)}><X/>Reject</button></div>:<span className={`badge ${proposal.status==="APPROVED"?"badge-success":"badge-danger"}`}>{proposal.status}</span>}</td></tr>)}</tbody></table>{!review.proposals.length&&<div className="empty">No changes were proposed. The submitted information matched the current record.</div>}</section>
    {!["COMPLETED","REVOKED"].includes(review.status)&&<section className="card" style={{padding:22,marginTop:18}}><h2>Complete review</h2><p>Completion applies accepted changes only. Rejected values are retained in the audit trail and do not alter the student record.</p><button className="btn primary" disabled={pending>0||!!busy} onClick={()=>void action({action:"complete"},"complete")}><Check/>Apply accepted changes and complete</button></section>}
  </>;
}
