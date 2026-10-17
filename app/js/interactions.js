// Curated screening only. Never change prescribed medication doses/times.
// https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/
// https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/
// https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/
// https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c760d0cc-2245-4914-8c67-d536c41ac90f
// https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/
// https://www.nccih.nih.gov/health/red-yeast-rice
// https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/
// https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=513a41d0-37d4-4355-8a6d-a2c643bce6fa
export const DISCLAIMER={th:'ไม่ครอบคลุมทุกกรณี ปรึกษาเภสัชกร',en:'Not exhaustive. Consult a pharmacist.'};
export const MEDICATIONS=['Warfarin / วาร์ฟาริน','Apixaban','Rivaroxaban','Levothyroxine / เลโวไทรอกซีน','Metformin / เมตฟอร์มิน','Simvastatin','Atorvastatin','Rosuvastatin','Phenelzine','Tranylcypromine','Spironolactone','Furosemide','Hydrochlorothiazide'];
const classes={anticoagulant:/warfarin|วาร์ฟาริน|apixaban|rivaroxaban|dabigatran|anticoagulant/i,thyroid:/levothyroxine|เลโวไทรอกซีน|eltroxin|euthyrox/i,metformin:/metformin|เมตฟอร์มิน/i,statin:/statin|สแตติน/i,maoi:/phenelzine|tranylcypromine|isocarboxazid|maoi/i,diuretic:/spironolactone|furosemide|hydrochlorothiazide|amiloride|diuretic/i};
export function interactionWarnings(medications=[],product={},profile={}){
 const text=[product.id,product.category,product.name?.en,product.name?.th,...(product.tags||[])].join(' '),out=[];
 for(const med of medications){const name=med.name||'';const add=(th,en,hours=0)=>out.push({medication:med.id,warning:{th,en},hours});
 if(classes.anticoagulant.test(name)&&/vitamin.?[ek]|วิตามิน[อีเค]|fish.?oil|omega|astaxanthin|multi/i.test(text))add('ยาต้านการแข็งตัวของเลือด: ให้เภสัชกรตรวจวิตามิน E/K น้ำมันปลา และสูตรแอสตาแซนธิน (หลักฐานจำกัด) ห้ามเปลี่ยนยาเอง','Anticoagulant: pharmacist review of vitamins E/K, fish oil and astaxanthin blends (limited evidence). Do not change medication yourself.');
 if(classes.thyroid.test(name)&&/calcium|iron|multi|whey|protein|แคลเซียม|เหล็ก|เวย์/i.test(text))add('แยกอาหารเสริมแคลเซียม/เหล็ก/วิตามินรวม และเวย์ที่มีแร่ธาตุจากเลโวไทรอกซีน 4 ชั่วโมง ตรวจฉลากกับเภสัชกร','Separate calcium/iron/multivitamins and mineral-containing whey from levothyroxine by 4 hours; verify the label with a pharmacist.',4);
 if(classes.metformin.test(name))add('เมตฟอร์มินอาจลดวิตามิน B12 ควรปรึกษาเรื่องการตรวจระดับ','Metformin can lower B12; ask about monitoring.');
 if(classes.statin.test(name)&&/red.?yeast|ข้าวยีสต์แดง/i.test(text))add('ข้าวยีสต์แดงอาจเพิ่มผลข้างเคียงของสแตติน','Red yeast rice may add to statin adverse effects.');
 if(classes.maoi.test(name))add('MAOI: เลี่ยงอาหารไทรามีนสูง เช่น ชีสบ่ม เนื้อหมัก ปรึกษาเภสัชกร','MAOI: avoid high-tyramine foods such as aged cheese and cured meats; consult a pharmacist.');
 if(classes.diuretic.test(name)&&/potassium|โพแทสเซียม|multi/i.test(text))add('ยาขับปัสสาวะบางชนิดเพิ่ม บางชนิดลดโพแทสเซียม ให้แพทย์ตรวจระดับก่อนเสริม','Diuretics can raise or lower potassium; check levels and the specific drug before supplementing.');
 }
 if(profile.medical?.enabled&&profile.medical.conditions?.includes('kidney')&&/creatine/i.test(text))out.push({warning:{th:'โรคไต: ปรึกษาแพทย์ก่อนใช้ครีเอทีน',en:'Kidney disease: consult your clinician before creatine.'},hours:0});
 return out;
}
const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
// Search all times, considering adjacent days. If no safe slot exists, leave unscheduled.
export function supplementTime(start,medications,product,profile,allowed=()=>true){
 const warnings=interactionWarnings(medications,product,profile),blocks=warnings.filter(w=>w.hours).flatMap(w=>(medications.find(m=>m.id===w.medication)?.times||[]).map(t=>({min:minutes(t),gap:w.hours*60})));
 if(!blocks.length)return {min:start,warnings};
 for(let delta=0;delta<1440;delta++){const at=start+delta;if(!allowed(at))continue;if(blocks.every(b=>{const distance=Math.abs(((at%1440)+1440)%1440-b.min);return Math.min(distance,1440-distance)>=b.gap;}))return {min:at,warnings};}
 return {min:null,warnings};
}
