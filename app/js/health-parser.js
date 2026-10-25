import {mergeHealth,healthFields} from './health-model.js';
const types={StepCount:'steps',DistanceWalkingRunning:'distance_m',ActiveEnergyBurned:'active_kcal',RestingHeartRate:'resting_hr',HeartRate:'avg_hr',BodyMass:'weight_kg',SleepAnalysis:'sleep_min'};
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function union(ranges,a,b){ranges.push([a,b]);ranges.sort((a,b)=>a[0]-b[0]);const result=[];for(const r of ranges){const prev=result.at(-1);if(prev&&r[0]<=prev[1])prev[1]=Math.max(prev[1],r[1]);else result.push(r);}return result;}
export function createHealthParser({from,to}={}){
 let buffer='',cancelled=false,records=0;const days=new Map();
 function sleepRecord(a){
  if(!/^(HKCategoryValueSleepAnalysisAsleep(?:Core|Deep|REM|Unspecified)?|1|3|4|5)$/.test(a.value))return;
  const parse=v=>Date.parse(v?.replace(' ','T').replace(' ','').replace(/([+-]\d{2})(\d{2})$/,'$1:$2')),start=parse(a.startDate),end=parse(a.endDate);
  const offset=a.startDate?.match(/([+-])(\d{2})(\d{2})$/);if(!offset||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)return;
  const shift=(offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]))*60000,source=(a.sourceName||'unknown').slice(0,200);
  for(let at=start;at<end;){const date=new Date(at+shift).toISOString().slice(0,10),next=Date.parse(date+'T00:00:00Z')+86400000-shift,until=Math.min(end,next);if((!from||date>=from)&&(!to||date<=to)){const id=date+'|'+source;if(!days.has(id)){if(days.size>=20000)throw Error('Too many sources or days');days.set(id,{date,source,counts:{},sleep:[]});}const row=days.get(id);row.sleep=union(row.sleep,at,until);if(row.sleep.length>10000)throw Error('Too many sleep intervals');row.sleep_min=row.sleep.reduce((n,[a,b])=>n+(b-a)/60000,0);}at=until;}
 }
 function record(text){const a=attrs(text),suffix=a.type?.replace(/^HK(?:Quantity|Category)TypeIdentifier/,''),key=types[suffix];if(!key)return;if(key==='sleep_min'){sleepRecord(a);return;}const date=(key==='sleep_min'?a.endDate:a.startDate)?.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||from&&date<from||to&&date>to)return;
  const source=(a.sourceName||'unknown').slice(0,200),id=date+'|'+source;if(!days.has(id)){if(days.size>=20000)throw Error('Too many sources or days; choose a shorter range');days.set(id,{date,source,counts:{},sleep:[]});}const row=days.get(id);let v=Number(a.value);

  if(!Number.isFinite(v)||v<0)return;
  if(key==='distance_m'){if(a.unit==='km')v*=1000;else if(a.unit==='mi')v*=1609.344;else if(a.unit!=='m')return;}
  if(key==='weight_kg'){if(a.unit==='lb')v*=0.45359237;else if(a.unit==='g')v/=1000;else if(a.unit!=='kg')return;}
  if(key==='active_kcal'){if(a.unit==='kJ')v/=4.184;else if(a.unit!=='kcal')return;}
  if(['steps','distance_m','active_kcal'].includes(key))row[key]=(row[key]||0)+v;
  else if(['resting_hr','avg_hr'].includes(key)){row.counts[key]=(row.counts[key]||0)+1;row[key]=(row[key]||0)+(v-(row[key]||0))/row.counts[key];if(key==='avg_hr')row.max_hr=Math.max(row.max_hr||0,v);}
  else row[key]=v;
 }
 return {push(chunk){if(cancelled)throw Error('Import cancelled');buffer+=chunk;let at;while((at=buffer.indexOf('>'))!==-1){const tag=buffer.slice(0,at+1);buffer=buffer.slice(at+1);if(/<Record\s/.test(tag)){record(tag);records++;}}if(buffer.length>65536)throw Error('XML tag exceeds limit');return records;},finish(){if(cancelled)throw Error('Import cancelled');if(buffer.trim())throw Error('Incomplete XML');return mergeHealth([...days.values()].filter(r=>healthFields.some(k=>Number.isFinite(r[k])))).map(({sources,source,...d})=>d);},cancel(){cancelled=true;buffer='';days.clear();},get buffered(){return buffer.length;}};
}
