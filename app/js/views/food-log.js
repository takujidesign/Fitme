import {featureUsed} from '../telemetry.js';
import { creditCost } from '../ai-credits.js';
import { actions, rerender } from '../core.js';
import { getState, updateLog, putImage, uid } from '../store.js';
import { L, esc, sheet, closeSheet, toast } from '../ui.js';
import { FOODS } from '../foods.js';

export const mealLogButtons = iso => `<div class="row gap"><button class="btn ghost" data-act="barcode-scan" data-iso="${iso}">${L('สแกนบาร์โค้ด','Scan barcode')}</button><button class="btn ghost" data-act="meal-photo" data-iso="${iso}">${L('ถ่ายรูปอาหาร', 'Meal photo')} ${creditCost('mealPhoto')}</button><button class="btn ghost" data-act="food-quick" data-iso="${iso}">${L('กินนอกแผน', 'Log extra food')}</button></div>`;
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
        featureUsed('meal_logged');updateLog(iso,l=>{(l.foodLog ||= []).push({time:new Date().toTimeString().slice(0,5),items,totals:sumItems(items),...(photoId?{photoId}:{})});});
        closeSheet();rerender();
      } catch(err){toast(err.message,'warn');e.target.disabled=false;}
    };
  }});
}
actions['food-quick']=el=>{
  const iso=el.dataset.iso;
  sheet(`<h2>${L('กินนอกแผน','Log extra food')}</h2><label class="field">${L('อาหาร','Food')}<div class="input-wrap"><select id="quick-food">${FOODS.map(f=>`<option value="${esc(f.id)}">${esc(L(f))}</option>`).join('')}</select></div></label><button class="btn primary" id="quick-next">${L('ต่อไป','Next')}</button>`,{onMount(root){root.querySelector('#quick-next').onclick=()=>{const f=FOODS.find(f=>f.id===root.querySelector('#quick-food').value);editor(iso,[{name:{th:f.th,en:f.en,source:f.source},grams:100,kcal:f.k,p:f.p,c:f.c,f:f.f,confidence:'high'}]);};}});
};
actions['meal-photo']=async el=>(await import('./meal-photo.js')).showMealPhoto(el.dataset.iso);
