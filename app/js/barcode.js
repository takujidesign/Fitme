import {featureUsed} from './telemetry.js';
import { actions, rerender } from './core.js';
import { getState, setState, updateLog, todayISO } from './store.js';
import { L, sheet, esc, closeSheet, toast } from './ui.js';
export const validBarcode=code=>/^\d{8,14}$/.test(code);
export function productFood(code,p){
 const n=p.nutriments||{},grams=Number(p.serving_quantity)||Number(/^([\d.]+)\s*g\b/i.exec(p.serving_size||'')?.[1]);
 const value=k=>Number.isFinite(Number(n[k+'_100g']))?Number(n[k+'_100g']):grams>0&&Number.isFinite(Number(n[k+'_serving']))?Number(n[k+'_serving'])*100/grams:NaN;
 const f={source:'off',id:'my-barcode-'+code,barcode:code,th:p.product_name||code,en:p.product_name||code,brand:p.brands||'',imageUrl:/^https:\/\//.test(p.image_front_url||'')?p.image_front_url:'',cat:'carb',k:value('energy-kcal'),p:value('proteins'),c:value('carbohydrates'),f:value('fat'),unit:{th:'หน่วยบริโภค',en:'serving',g:grams||100},tags:[],useInPlan:false};
 if(!['k','p','c','f'].every(k=>Number.isFinite(f[k])&&f[k]>=0))return null;return f;
}
export async function lookupBarcode(code){featureUsed('food_scan_barcode');
 if(!validBarcode(code))throw Error('Invalid barcode');const own=getState().customFoods.find(f=>f.barcode===code);if(own)return own;
 let cache={};try{cache=JSON.parse(localStorage.getItem('fitme:barcodes')||'{}');}catch{}if(cache[code])return cache[code];
 const r=await fetch('https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields=product_name,brands,nutriments,serving_size,serving_quantity,image_front_url',{signal:AbortSignal.timeout(12000)});if(!r.ok&&r.status!==404)throw Error('Food lookup unavailable');const data=await r.json(),food=data.status===1?productFood(code,data.product):null;
 if(food){cache[code]=food;try{localStorage.setItem('fitme:barcodes',JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-200))));}catch{}}return food;
}
let zxing;
async function loadZXing(){if(window.ZXingBrowser)return window.ZXingBrowser;zxing??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';script.onload=()=>resolve(window.ZXingBrowser);script.onerror=()=>{zxing=null;reject(Error('Scanner unavailable. Enter the barcode manually.'));};document.head.append(script);});return zxing;}
export async function startScanner(video,onCode){
 let stream,controls,stopped=false,frame;
 const stop=()=>{stopped=true;cancelAnimationFrame(frame);controls?.stop();stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;};
 try{
 if('BarcodeDetector' in window){const formats=await window.BarcodeDetector.getSupportedFormats(),supported=['ean_13','ean_8','upc_a','upc_e','code_128'].filter(f=>formats.includes(f));if(!supported.length)throw Error('fallback');const detector=new window.BarcodeDetector({formats:supported});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();const scan=async()=>{if(stopped)return;try{const found=await detector.detect(video);if(found[0]){onCode(found[0].rawValue);stop();return;}}catch{}if(!stopped)frame=requestAnimationFrame(scan);};scan();return stop;}
 }catch(e){stop();if(e.name==='NotAllowedError')throw e;stopped=false;}
 try{const ZX=await loadZXing();controls=await new ZX.BrowserMultiFormatReader().decodeFromConstraints({video:{facingMode:{ideal:'environment'}}},video,(result,error,control)=>{if(result&&!stopped){onCode(result.getText());control.stop();stop();}});return stop;}catch(e){stop();throw e;}
}
function review(code,food,iso){
 sheet(`<h2>${L('ตรวจสอบฉลาก','Review label')}</h2><p>${food?esc(food.brand||'Open Food Facts'):L('ไม่พบข้อมูล กรอกด้วยตนเอง','Not found. Enter manually.')}</p>${food?'<p>ข้อมูลจาก Open Food Facts (ODbL)</p>':''}<form id="barcode-food"><label class="field">${L('ชื่อ','Name')}<input name="name" required maxlength="100" value="${esc(food?.en||'')}"></label><p>${L('ค่าต่อ 100 กรัม','Values per 100 g')}</p>${['k','p','c','f'].map(k=>`<label class="field">${{k:'kcal',p:'Protein',c:'Carbs',f:'Fat'}[k]}<input name="${k}" type="number" required min="0" max="10000" step="any" value="${food?.[k]??''}"></label>`).join('')}<label class="field">${L('กรัมที่กิน','Grams eaten')}<input name="grams" type="number" min="1" max="10000" value="${food?.unit.g||100}" required></label><button class="btn primary">${L('บันทึกอาหารและฉลาก','Save food and label')}</button></form>`,{onMount(root){root.querySelector('form').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target),name=fd.get('name').trim(),grams=Number(fd.get('grams'));if(!name)return;const f={...food,id:'my-barcode-'+code,barcode:code,th:name,en:name,cat:food?.cat||'carb',tags:food?.tags||[],useInPlan:false,unit:{th:'หน่วย',en:'serving',g:grams},...Object.fromEntries(['k','p','c','f'].map(k=>[k,Number(fd.get(k))]))};if(!['k','p','c','f'].every(k=>Number.isFinite(f[k])&&f[k]>=0))return;setState(s=>{s.customFoods=s.customFoods.filter(x=>x.barcode!==code);s.customFoods.push(f);});const item={source:f.source,name:{th:name,en:name,source:f.source},grams,kcal:f.k*grams/100,p:f.p*grams/100,c:f.c*grams/100,f:f.f*grams/100};updateLog(iso,l=>(l.foodLog||=[]).push({time:new Date().toTimeString().slice(0,5),items:[item],totals:{kcal:item.kcal,p:item.p,c:item.c,f:item.f}}));closeSheet();rerender();};}});
}
actions['barcode-scan']=el=>{
 const iso=el.dataset.iso||todayISO();let stop=()=>{},observer;
 const wrap=sheet(`<h2>${L('สแกนบาร์โค้ด','Scan barcode')}</h2><video muted playsinline style="width:100%"></video><button class="btn ghost" id="barcode-camera">${L('เปิดกล้องหลัง','Open rear camera')}</button><input id="barcode-code" inputmode="numeric" maxlength="14" aria-label="Barcode"><button class="btn primary" id="barcode-find">${L('ค้นหา','Look up')}</button><p role="status"></p>`,{onMount(root){const find=async code=>{stop();if(!validBarcode(code))return toast(L('บาร์โค้ดไม่ถูกต้อง','Invalid barcode'),'warn');try{review(code,await lookupBarcode(code),iso);}catch{review(code,null,iso);}};root.querySelector('#barcode-find').onclick=()=>find(root.querySelector('#barcode-code').value.trim());root.querySelector('#barcode-camera').onclick=async()=>{try{stop();stop=await startScanner(root.querySelector('video'),find);if(!root.isConnected)stop();}catch(e){root.querySelector('[role=status]').textContent=e.message;}};}});
 observer=new MutationObserver(()=>{if(!wrap.isConnected||!wrap.classList.contains('open')){stop();observer.disconnect();}});requestAnimationFrame(()=>observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}));
};
