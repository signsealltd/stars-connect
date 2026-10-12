type SummaryCell={requirement:string;state:string};
export function trainingProgress(cells:SummaryCell[]) {
  const required=cells.filter(cell=>cell.requirement==="REQUIRED");
  const current=required.filter(cell=>cell.state==="CURRENT"||cell.state==="DUE_SOON").length;
  return {total:required.length,current,expired:required.filter(c=>c.state==="EXPIRED").length,missing:required.filter(c=>c.state==="MISSING").length,due:required.filter(c=>c.state==="DUE_SOON").length,percent:required.length?Math.round(current/required.length*100):0};
}
export function trainingCsv(rows:unknown[][]) {
  return "\uFEFF"+rows.map(row=>row.map(value=>{
    let text=String(value??"");
    if(/^\s*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
    return `"${text.replaceAll('"','""')}"`;
  }).join(",")).join("\r\n");
}
