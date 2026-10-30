import {privateReminder} from './reminder-privacy.js';
import {stableHash} from './calendar.js';
import {getState,todayISO,addDays} from './store.js';
import {planDay} from './day.js';
import {L,toMin,toHHMM} from './ui.js';
export const deviceZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
export const reminderID=r=>stableHash(`${r.date}:${r.time}:${r.category||'general'}:${r.route||''}:${r.eventKey||''}`);
export const reminderTime=r=>new Date(r.date+'T'+r.time+':00').getTime();
export function reminderPlan(start=todayISO(),preferences,days=7,details=false) {
  const s=getState(),prefs=preferences||s.notifications,p=s.profile,out=[];
  const add=(iso,min,title,body,route,category='general',eventKey='')=>{const time=toHHMM(min),a=prefs.quietStart,b=prefs.quietEnd;if(a&&b&&a!==b&&(a<b?time>=a&&time<b:time>=a||time<b))return;out.push({date:addDays(iso,Math.floor(min/1440)),time,title:title.slice(0,120),body:body.slice(0,500),route,category,eventKey});};
  for(let i=0;i<days;i++){
    const iso=addDays(start,i),d=planDay(iso);
    for(const e of d.events){
      const kind={meal:'meals',supp:'supplements',workout:'workout',fasting:'fasting',medication:'medications'}[e.type];
      if(!kind||!prefs[kind])continue;
      if(e.type==='medication')add(iso,e.min,e.medication.name,e.medication.name+' · '+e.medication.dose+' · '+L({th:{with:'พร้อมอาหาร',without:'ท้องว่าง',any:'ตามคำสั่งแพทย์'}[e.medication.food],en:{with:'With food',without:'Without food',any:'As prescribed'}[e.medication.food]}),'#/me','medications',e.key);
      if(e.type==='meal')add(iso,e.min,L('ถึงเวลาทานอาหาร','Meal time'),L(e.meal.name),'#/food','meals',e.key);
      if(e.type==='supp')add(iso,e.min,L('อาหารเสริม','Supplements'),e.list.map(x=>L(x.prod.name)).join(', ').slice(0,500),'#/supps','supplements',e.key);
      if(e.type==='workout'&&d.train&&d.sess?.type!=='rest')add(iso,e.min,L('เวลาออกกำลังกาย','Workout time'),'Fixmee','#/player/'+iso,'workout',e.key);
      if(e.type==='fasting')add(iso,e.min,e.eating?L('เริ่มกินได้','Eating window starts'):L('เริ่ม IF','Fasting starts'),'Fixmee','#/today','fasting',e.key);
    }
    let bed=toMin(p.bed),wake=toMin(p.wake);if(bed<=wake)bed+=1440;
    if(prefs.wake)add(iso,wake,L('ตื่นนอน','Wake up'),'Fixmee','#/today','wake');
    if(prefs.water)for(let min=wake;min<bed;min+=120)add(iso,min,L('ดื่มน้ำ','Drink water'),'Fixmee','#/today','water');
    if(prefs.sleep){add(iso,bed-30,L('เตรียมนอน','Prepare for sleep'),'Fixmee','#/today','sleep');add(iso,bed,L('เวลานอน','Bedtime'),'Fixmee','#/today','sleep');}
  }
  if(s.premium?.until){const expires=new Date(s.premium.until);if(Number.isFinite(expires.getTime())){const day=addDays(expires.toISOString().slice(0,10),-1);if(day>=start&&day<=addDays(start,days-1))add(day,9*60,L('สมาชิกใกล้หมดอายุ','Membership expires soon'),L('ตรวจสอบสถานะสมาชิกและการต่ออายุ','Check your membership and renewal status'),'#/me');}}
  return out.map(r=>{const {eventKey,...publicFields}=r,item={...publicFields,id:reminderID(r)};return details?{...item,eventKey}:privateReminder(item,{...prefs,lang:s.lang});});
}
