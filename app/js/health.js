import { getState, setState, todayISO } from './store.js';
import { L, esc, sheet, toast } from './ui.js';
import { actions, rerender } from './core.js';
export const healthSupported=()=>!!globalThis.window?.Capacitor?.isNativePlatform?.();
// The injected native bridge calls the installed Capgo Health plugin directly,
// keeping the published web app as static modules without a bundled SDK.
const call=(method,options={})=>window.Capacitor.nativePromise('Health',method,options);
const TYPES=['steps','sleep','restingHeartRate','calories','weight'];
export async function readHealth(){
  if(!healthSupported())return {status:'unsupported'};
  if(!(await call('isAvailable')).available)return {status:'unsupported'};
  await call('requestAuthorization',{read:TYPES,write:[]});
  const endDate=new Date().toISOString(),startDate=new Date(Date.now()-7*86400000).toISOString();
  const results=await Promise.allSettled(TYPES.map(dataType=>call('readSamples',{dataType,startDate,endDate,limit:10000,ascending:true})));
  const data={},errors=[];results.forEach((r,i)=>{data[TYPES[i]]=r.status==='fulfilled'?r.value.samples:[];if(r.status==='rejected')errors.push(TYPES[i]);});
  return {status:'ready',data,errors};
}
// Union overlapping sleep intervals (stages and multiple sources) before summing.
export function sleepByDate(samples){
  const dates={};
  for(const s of samples){if(['awake','inBed'].includes(s.sleepState))continue;const start=Date.parse(s.startDate),end=Date.parse(s.endDate);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)continue;const date=todayISO(new Date(end));(dates[date]||=[]).push([start,end]);}
  return Object.fromEntries(Object.entries(dates).map(([date,ranges])=>{ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}return [date,{hours:merged.reduce((n,[a,b])=>n+(b-a)/3600000,0),bed:new Date(merged[0][0]).toTimeString().slice(0,5),wake:new Date(merged.at(-1)[1]).toTimeString().slice(0,5),source:'health'}];}));
}
export function importHealth(data){
  setState(s=>{
    for(const sample of data.weight||[]){const at=new Date(sample.startDate);if(!Number.isFinite(at.getTime())||!(sample.value>25&&sample.value<300)||sample.unit&&sample.unit!=='kilogram')continue;const date=todayISO(at);if(!s.weights.some(w=>w.date===date))s.weights.push({date,kg:sample.value,source:'health'});}
    s.weights.sort((a,b)=>a.date.localeCompare(b.date));
    for(const [date,sleep] of Object.entries(sleepByDate(data.sleep||[]))){const log=s.logs[date]||={done:{},water:0};if(!log.sleep)log.sleep=sleep;}
  });
}
export const healthCard=()=>healthSupported()?`<section class="card"><h2>${L('ข้อมูลสุขภาพ','Health data')}</h2><p>${L('อ่านข้อมูล 7 วันล่าสุดจาก HealthKit / Health Connect','Read the last 7 days from HealthKit / Health Connect')}</p><button class="btn ghost block" data-act="health-read">${L('เชื่อมต่อและอ่านข้อมูล','Connect and read data')}</button></section>`:'';
actions['health-read']=async el=>{el.disabled=true;try{
  const result=await readHealth();if(result.status!=='ready')throw Error(L('อุปกรณ์นี้ไม่รองรับข้อมูลสุขภาพ','Health data is unsupported on this device'));
  const names={steps:L('ก้าว','Steps'),sleep:L('การนอน','Sleep'),restingHeartRate:L('ชีพจรขณะพัก','Resting heart rate'),calories:L('พลังงานกิจกรรม','Active energy'),weight:L('น้ำหนัก','Weight')};
  sheet(`<h2>${L('ข้อมูลสุขภาพ 7 วัน','Health data · 7 days')}</h2><p class="note">${L('ข้อมูลว่างอาจหมายถึงไม่อนุญาตให้อ่าน นำเข้าเฉพาะวันที่ยังไม่มีบันทึกน้ำหนักหรือการนอน','Empty results can mean access was denied. Import fills only dates without existing weight or sleep logs.')}</p>${TYPES.map(k=>`<h3>${names[k]}</h3>${result.errors.includes(k)?`<p>${L('อ่านไม่ได้ / ไม่ได้รับอนุญาต','Unavailable / access denied')}</p>`:result.data[k].length?`<p>${result.data[k].length} ${L('รายการ','samples')}</p><ul>${result.data[k].slice(-14).map(s=>`<li>${esc(s.startDate?.slice(0,10))}: ${Number(s.value).toFixed(1)} ${esc(s.unit)} ${esc(s.sleepState||'')}</li>`).join('')}</ul>`:`<p>—</p>`}`).join('')}<button class="btn primary block" id="health-import">${L('นำเข้าน้ำหนักและการนอน','Import weight and sleep')}</button>`,{onMount(root){root.querySelector('#health-import').onclick=()=>{importHealth(result.data);rerender();toast(L('นำเข้าแล้ว','Imported'));};}});
}catch(e){toast(e.message,'warn');}finally{el.disabled=false;}};
