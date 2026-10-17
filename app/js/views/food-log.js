import { actions, go, rerender, pickFiles } from '../core.js';
import { getState, updateLog, compressImage, blobToBase64, putImage, uid } from '../store.js';
import { L, esc, sheet, closeSheet, toast } from '../ui.js';
import { FOODS } from '../foods.js';
import { hasPro, askCoach } from '../pay.js';
import { CONFIG } from '../config.js';

export const mealLogButtons = iso => `<div class="row gap"><button class="btn ghost" data-act="barcode-scan" data-iso="${iso}">${L('สแกนบาร์โค้ด','Scan barcode')}</button><button class="btn ghost" data-act="meal-photo" data-iso="${iso}">${L('ถ่ายรูปอาหาร', 'Meal photo')}</button><button class="btn ghost" data-act="food-quick" data-iso="${iso}">${L('กินนอกแผน', 'Log extra food')}</button></div>`;
export const foodLogHTML = iso => (getState().logs[iso]?.foodLog || []).map(e => `<section class="card"><b>${esc(e.time)} · ${Math.round(e.totals.kcal)} kcal</b><p>${e.items.map(it => `${esc(L(it.name))} ${it.grams} g`).join(' · ')}</p></section>`).join('');
export const sumItems = items => Object.fromEntries(['kcal','p','c','f'].map(k => [k, items.reduce((n,it) => n + it[k], 0)]));
export const scaleItem = (item, grams) => ({ ...item, grams, ...Object.fromEntries(['kcal','p','c','f'].map(k => [k, item[k] * grams / item.grams])) });
function editor(iso, initial, photos = []) {
  const items = structuredClone(initial);
  sheet(`<h2>${L('ตรวจสอบอาหาร', 'Review food')}</h2><p class="note">${L('ค่าประมาณคร่าว ๆ ปรับกรัมก่อนบันทึก', 'Rough estimate. Adjust grams before saving.')}</p><div id="food-items">${items.map((it,i) => `<label class="field"><span>${esc(L(it.name))} · ${L({th: {low:'มั่นใจน้อย',medium:'มั่นใจปานกลาง',high:'มั่นใจสูง'}[it.confidence], en:it.confidence})}</span><div class="input-wrap"><input data-item="${i}" type="number" min="1" max="10000" step="1" value="${it.grams}"><span>g</span></div></label>`).join('')}</div><p id="food-total"></p>${photos.length ? `<label><input type="checkbox" id="food-keep"> ${L('เก็บรูปในเครื่อง', 'Keep photo on device')}</label>` : ''}<button class="btn primary block" id="food-save">${L('บันทึก', 'Save')}</button>`, { onMount(root) {
    const update = () => { const t=sumItems(items); root.querySelector('#food-total').textContent=`${Math.round(t.kcal)} kcal · P ${t.p.toFixed(1)} · C ${t.c.toFixed(1)} · F ${t.f.toFixed(1)} g`; };
    root.querySelectorAll('[data-item]').forEach(el => el.oninput=()=>{ if(el.checkValidity()) {items[Number(el.dataset.item)]=scaleItem(initial[Number(el.dataset.item)], Number(el.value));update();} }); update();
    root.querySelector('#food-save').onclick=async e=>{
      if(![...root.querySelectorAll('[data-item]')].every(el=>el.reportValidity()) || !items.length)return;
      e.target.disabled=true;
      try {
        let photoId;
        if(root.querySelector('#food-keep')?.checked) { photoId='meal-'+uid(); await putImage(photoId,photos[0]); }
        updateLog(iso,l=>{(l.foodLog ||= []).push({time:new Date().toTimeString().slice(0,5),items,totals:sumItems(items),...(photoId?{photoId}:{})});});
        closeSheet();rerender();
      } catch(err){toast(err.message,'warn');e.target.disabled=false;}
    };
  }});
}
actions['food-quick']=el=>{
  const iso=el.dataset.iso;
  sheet(`<h2>${L('กินนอกแผน','Log extra food')}</h2><label class="field">${L('อาหาร','Food')}<div class="input-wrap"><select id="quick-food">${FOODS.map(f=>`<option value="${esc(f.id)}">${esc(L(f))}</option>`).join('')}</select></div></label><button class="btn primary" id="quick-next">${L('ต่อไป','Next')}</button>`,{onMount(root){root.querySelector('#quick-next').onclick=()=>{const f=FOODS.find(f=>f.id===root.querySelector('#quick-food').value);editor(iso,[{name:{th:f.th,en:f.en},grams:100,kcal:f.k,p:f.p,c:f.c,f:f.f,confidence:'high'}]);};}});
};
actions['meal-photo']=el=>{
  if(!CONFIG.API_BASE)return toast(L('ต้องตั้งค่าเซิร์ฟเวอร์ก่อนใช้ AI','AI requires a server'),'warn');
  if(!hasPro())return go('#/pay');
  const iso=el.dataset.iso;
  sheet(`<h2>${L('ถ่ายรูปอาหาร','Meal photo')}</h2><p>${L('เลือก 1–2 รูปของมื้อเดียวกัน รูปจะส่งให้เซิร์ฟเวอร์และ Claude เพื่อประเมิน โดย Worker ไม่เก็บรูป','Choose 1–2 photos of the same meal. Photos go to the server and Claude for estimation; the Worker does not store them.')}</p><label class="field">${L('หมายเหตุ (ไม่บังคับ)','Note (optional)')}<div class="input-wrap"><input id="meal-note" maxlength="1000"></div></label><button class="btn primary" id="meal-select">${L('ยินยอมและเลือกรูป','Agree and choose photos')}</button>`,{onMount(root){root.querySelector('#meal-select').onclick=async e=>{
    const button=e.target, note=root.querySelector('#meal-note').value;button.disabled=true;
    try {const files=await pickFiles({accept:'image/jpeg,image/png,image/webp',multiple:true});if(!files.length)return;if(files.length>2)throw Error(L('เลือกไม่เกิน 2 รูป','Choose at most 2 photos'));const photos=await Promise.all(files.map(f=>compressImage(f)));const images=await Promise.all(photos.map(async b=>({media_type:b.type,data:await blobToBase64(b)})));const result=await askCoach('meal-photo',{images,note});if(!result.items.length)throw Error(L('ไม่พบอาหารในรูป','No food detected'));editor(iso,result.items,photos);}catch(err){toast(err.message,'warn');}finally{button.disabled=false;}
  };}});
};
