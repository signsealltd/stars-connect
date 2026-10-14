import {sanitizePolicyHtml} from './policy-html';
/** Word uses styled paragraphs rather than semantic lists in its HTML clipboard. */
export function normalisePolicyPaste(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html');
 for(const parent of Array.from(doc.body.querySelectorAll('td,th,div')).concat(doc.body)){
  let stack:{list:HTMLElement;item:HTMLElement|null}[]=[];let listId='';
  for(const node of Array.from(parent.children)){
   const style=node.getAttribute('style')||'';const list=style.match(/mso-list:\s*(l\d+)\s+level(\d+)/i);
   if(!list){stack=[];listId='';continue}
   const marker=Array.from(node.querySelectorAll('span')).find(span=>/mso-list:\s*ignore/i.test(span.getAttribute('style')||''));
   const markerText=marker?.textContent?.trim()||'';
   const ordered=/^(?:\d+|[a-z]|[ivxlcdm]+)[.)]/i.test(markerText);const tag=ordered?'ol':'ul';marker?.remove();
   let level=Math.max(1,Math.min(9,Number(list[2])));
   if(listId!==list[1]){stack=[];listId=list[1]}
   level=Math.min(level,stack.length+1);stack=stack.slice(0,level);
   if(stack[level-1]?.list.tagName.toLowerCase()!==tag)stack=stack.slice(0,level-1);
   while(stack.length<level){const el=doc.createElement(tag);const previous=stack[stack.length-1];if(previous?.item)previous.item.append(el);else parent.insertBefore(el,node);stack.push({list:el,item:null})}
   const item=doc.createElement('li');while(node.firstChild)item.append(node.firstChild);stack[level-1].list.append(item);stack[level-1].item=item;node.remove();
  }
 }
 for(const p of Array.from(doc.body.querySelectorAll('p'))){const match=p.className.match(/MsoHeading([1-6])/i);if(match){const heading=doc.createElement('h'+match[1]);while(p.firstChild)heading.append(p.firstChild);p.replaceWith(heading)}}
 return sanitizePolicyHtml(doc.body.innerHTML);
}
