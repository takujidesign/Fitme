// Shared deterministic daily merge: complete source wins, steps are never added across sources.
export const healthFields=['steps','distance_m','active_kcal','resting_hr','avg_hr','max_hr','sleep_min','weight_kg'];
export const healthRanges={steps:[0,100000],distance_m:[0,200000],active_kcal:[0,10000],resting_hr:[25,230],avg_hr:[25,230],max_hr:[25,230],sleep_min:[0,1440],weight_kg:[25,300]};
export function mergeHealth(rows){
 const dates={};for(const r of rows)(dates[r.date]||=[]).push(r);
 return Object.entries(dates).sort(([a],[b])=>a.localeCompare(b)).map(([date,list])=>{
  const count=r=>healthFields.filter(k=>Number.isFinite(r[k])).length;
  list.sort((a,b)=>count(b)-count(a)||(b.updated||0)-(a.updated||0)||a.source.localeCompare(b.source));
  const result={date,source:list[0].source,sources:{}};
  for(const k of healthFields){const available=list.filter(r=>Number.isFinite(r[k]));if(!available.length)continue;const row=k==='steps'?available.reduce((a,b)=>b.steps>a.steps?b:a):available[0];result[k]=row[k];result.sources[k]=row.source;}
  return result;
 });
}
export {healthAdjustment,healthCheckin} from './health-math.js';
