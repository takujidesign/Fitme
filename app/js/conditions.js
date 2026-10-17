// Conservative wellness constraints, not treatment. Protein guidance:
// https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/identify-manage-patients/manage-ckd/slow-progression-reduce-complications
export const CONDITIONS={diabetes:{th:'เบาหวาน',en:'Diabetes'},hypertension:{th:'ความดันโลหิตสูง',en:'Hypertension'},gout:{th:'กรดยูริกสูง / เกาต์',en:'High uric acid / gout'},cholesterol:{th:'ไขมันในเลือดสูง',en:'High cholesterol'},kidney:{th:'โรคไต',en:'Kidney disease'},heart:{th:'โรคหัวใจ',en:'Heart disease'},other:{th:'อื่น ๆ',en:'Other'}};
export const hasCondition=(p,key)=>p.medical?.enabled===true&&p.medical.conditions?.includes(key);
export const medicalNoFasting=p=>hasCondition(p,'diabetes')&&!p.medical?.fastingCleared;
export function foodWarnings(p,f){const out=[];if(hasCondition(p,'hypertension'))out.push({th:'ลดโซเดียม เลี่ยงเติมน้ำปลาและซอสเค็ม',en:'Limit sodium; avoid salty sauces.'});if(hasCondition(p,'gout')&&(/shrimp|liver|organ|sardine|anchovy|tuna|beer/i.test(f.id)||f.highPurine))out.push({th:'พิวรีนสูง ควรจำกัด',en:'High purine: limit portions.'});return out;}
export function medicalFoodAllowed(p,f){
  if(hasCondition(p,'diabetes')&&['jasmine_rice','rice_noodles','rice_noodle'].includes(f.id))return false;
  if(hasCondition(p,'hypertension')&&(/sausage|bacon|salted|instant_noodle/.test(f.id)||f.sodium>600))return false;
  if(hasCondition(p,'gout')&&(/shrimp|liver|organ|sardine|anchovy|tuna|beer/.test(f.id)||f.highPurine))return false;
  return true;
}
export function medicalSession(p,session){
  if(!session)return session;
  if(hasCondition(p,'heart')&&!p.medical?.exerciseCleared)return {...session,type:'rest',items:[],minutes:0};
  if(!hasCondition(p,'heart'))return session;
  const intense=new Set(['jumping_jack','jump_rope','squat_jump','burpee','mountain_climber','high_knees','run_interval','jog']);
  return {...session,items:session.items.filter(i=>i.phase!=='finisher').map(i=>({...i,id:intense.has(i.id)?'walk':i.id,sets:Math.min(2,i.sets),rest:Math.max(60,i.rest||0),...(i.reps?{reps:'10-12'}:{})}))};
}
export function medicalNotes(p){
 const out=[];if(!p.medical?.enabled||!p.medical.conditions?.length)return out;
 out.push({th:'ปรึกษาแพทย์ — คำแนะนำสุขภาพทั่วไป ไม่ใช่การรักษา',en:'Consult your doctor — general wellness guidance, not treatment.'});
 if(hasCondition(p,'diabetes'))out.push({th:'กระจายคาร์บสม่ำเสมอ ระวังน้ำตาลต่ำขณะออกกำลัง ทำ IF เฉพาะเมื่อแพทย์อนุญาต',en:'Space carbohydrates evenly. Watch for hypoglycaemia during exercise. Fast only with medical clearance.'});
 if(hasCondition(p,'hypertension'))out.push({th:'ลดโซเดียม หายใจออกขณะออกแรง โดยเฉพาะ bench press / deadlift ห้ามกลั้นหายใจ',en:'Limit sodium. Exhale on effort, especially bench press / deadlift; avoid breath-holding.'});
 if(hasCondition(p,'gout'))out.push({th:'จำกัดอาหารพิวรีนสูงและเบียร์ ดื่มน้ำตามคำแนะนำแพทย์',en:'Limit high-purine foods and beer; follow your clinician’s hydration advice.'});
 if(hasCondition(p,'kidney'))out.push({th:'ปรึกษาแพทย์ก่อนปรับโปรตีน เป้าหมายไม่เกิน 0.8 กรัม/กก. งดจัดโปรตีนเสริมและครีเอทีนอัตโนมัติ และตรวจสอบข้อจำกัดน้ำ',en:'Consult your doctor before changing protein. Target capped at 0.8 g/kg; automatic protein/creatine supplements are withheld; review fluid restrictions.'});
 if(hasCondition(p,'heart'))out.push({th:'ต้องได้รับอนุญาตจากแพทย์ ออกกำลังระดับปานกลางเท่านั้น ไม่ทำ HIIT',en:'Medical clearance required; moderate activity only, no HIIT.'});
 return out;
}
