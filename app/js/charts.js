import {esc,L} from './ui.js';
export function chart(title,rows,type='bar'){
 const max=Math.max(1,...rows.map(r=>Number(r.count)||0)),w=300,h=140;
 const points=rows.map((r,i)=>`${i*w/Math.max(1,rows.length-1)},${h-(Number(r.count)||0)/max*(h-10)}`).join(' ');
 return `<section class="card usage-chart"><h2>${esc(title)}</h2><svg role="img" viewBox="0 0 300 150" style="width:100%;color:var(--teal)"><title>${esc(title)}</title>${type==='line'?`<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3"/>`:rows.map((r,i)=>`<rect x="${i*w/Math.max(1,rows.length)}" y="${h-r.count/max*(h-10)}" width="${Math.max(1,w/Math.max(1,rows.length)-3)}" height="${r.count/max*(h-10)}" fill="currentColor"><title>${esc(r.label)}: ${r.count}</title></rect>`).join('')}</svg><details><summary>${L('ดูเป็นตาราง','View as table')}</summary><table><thead><tr><th>${esc(title)}</th><th>${L('จำนวน','Count')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.count}</td></tr>`).join('')}</tbody></table></details></section>`;
}
export function usageCSV(rows){const cell=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"';return '\ufeff'+[['date','name','dim','value','count'],...rows.map(r=>[r.date,r.name,r.dim,r.value,r.count])].map(r=>r.map(cell).join(',')).join('\r\n');}
