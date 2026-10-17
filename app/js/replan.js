import { readiness } from './readiness.js';
import { addDays, diffDays, todayISO } from './store.js';
import { targets, bmr } from './calc.js';
export function activeBlock(s,date=todayISO()) { return s.blocks.filter(b=>b.startDate<=date).at(-1)||{startDate:s.profile.startDate,adjustments:{}}; }
export function blockProfile(s,date=todayISO()) {
 const b=activeBlock(s,date),latest=s.blocks.at(-1);
 const profile=b.profileSnapshot && b!==latest ? b.profileSnapshot : s.profile;
 return {...profile,...(b.profileSnapshot?{}:b.adjustments),blockStart:b.startDate};
}
export function blockDue(s,date=todayISO()) { return diffDays(activeBlock(s,date).startDate,date)>=28; }
export function blockSummary(s,start=activeBlock(s).startDate) {
 const end=addDays(start,27),p=blockProfile(s,start),logs=Object.entries(s.logs).filter(([d])=>d>=start&&d<=end).sort(([a],[b])=>a.localeCompare(b));
 const weights=s.weights.filter(w=>w.date>=start&&w.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
 let scheduled=0,done=0;
 for(let i=0;i<28;i++){const date=addDays(start,i),train=s.dayOverrides?.[date]==='train'||s.dayOverrides?.[date]!=='off'&&p.trainDays.includes(new Date(date+'T00:00:00').getDay());if(train){scheduled++;if(s.logs[date]?.done?.workout)done++;}}
 const sleep=logs.map(([,l])=>l.sleep?.hours).filter(Number.isFinite),kcal=logs.map(([,l])=>l.kcalAdherence).filter(Number.isFinite);
 const first={},last={},counts={};
 for(const [,l] of logs){const day={};for(const set of l.sets||[]){const score=set.kg*(1+set.reps/30);if(score>0)day[set.id]=Math.max(day[set.id]||0,score);}for(const [id,score] of Object.entries(day)){first[id]??=score;last[id]=score;counts[id]=(counts[id]||0)+1;}}
 const lifts=Object.keys(first).map(id=>({id,first:first[id],last:last[id],sessions:counts[id]}));
 const t=targets(p,true),rest=targets(p,false),avg=(t.kcal*p.trainDays.length+rest.kcal*(7-p.trainDays.length))/7;
 return {lowReadiness:logs.filter(([,l])=>l.checkin&&readiness(l.checkin).score<70).length,start,end,weightChange:weights.length>=2?weights.at(-1).kg-weights[0].kg:null,expected:(avg-t.tdee)*28/7700,kcalAdherence:kcal.length?kcal.reduce((a,b)=>a+b,0)/kcal.length:null,adherence:scheduled?done/scheduled:null,workouts:done,scheduled,lifts,sleep:sleep.length?sleep.reduce((a,b)=>a+b,0)/sleep.length:null,allProgressed:lifts.length>=2&&lifts.every(l=>l.sessions>=2&&l.last>l.first)};
}
export function proposeReplan(p,report) {
 const changes={},notes=[];
 if(['cut','bulk'].includes(p.goal)&&report.weightChange!==null&&Math.abs(report.expected)>.01){const direction=p.goal==='cut'?-1:1;if(report.weightChange*direction<Math.abs(report.expected)*.5){const current=targets(p,true).kcal;const floor=Math.max(bmr(p).value*1.05,p.sex==='female'?1200:1500);changes.calorieFactor=(p.calorieFactor||1)*Math.max(floor/current,1+direction*.05);}}
 if(report.adherence!==null&&report.adherence<.6){if(p.sessionMin>=25)changes.sessionMin=p.sessionMin-10;else if(p.trainDays.length>1)changes.trainDays=p.trainDays.slice(0,-1);notes.push('adherence');}
 if(report.allProgressed)changes.planSeed=(p.planSeed||0)+1;
 if((report.sleep!==null&&report.sleep<6.5)||report.lowReadiness>=7){changes.volumeAdjustment=Math.max(-3,(p.volumeAdjustment||0)-1);notes.push('recovery');}
 return {changes,notes};
}
