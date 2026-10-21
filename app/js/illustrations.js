import { L, esc } from './ui.js';
import { animateFigure, startFinishHTML, arrowSVG } from './figure.js';

export function approvedIllustrations(value) {
  if(!value || typeof value !== 'object' || Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([id,row])=>/^[a-z0-9_-]+$/i.test(id) && row?.source==='ai' && ['start','finish'].every(p=>row[p]===`img/ex/${id}-${p}.webp`) && (row.tool==='Codex image generation' || typeof row.model==='string') && typeof row.created==='string'));
}
export async function loadIllustrations(fetcher=globalThis.fetch) {
  try {const r=await fetcher(new URL('../data/illustrations.json',import.meta.url));return r.ok?approvedIllustrations(await r.json()):{};} catch {return {};}
}
export function illustrationHTML(ex,row) {
  return `<div class="illustration-pair">${['start','finish'].map((pose,i)=>`<figure><div class="illustration-frame"><img loading="lazy" src="${esc(row[pose])}" alt="${esc(L(ex.name))} - ${i?L('จบ','Finish'):L('เริ่ม','Start')}"><svg class="illustration-arrow" viewBox="0 0 200 200" aria-hidden="true">${arrowSVG(ex)}</svg></div><figcaption>${i?L('จบ','Finish'):L('เริ่ม','Start')}</figcaption></figure>`).join('')}</div><button type="button" class="btn ghost" data-crossfade>${L('สลับภาพ','Alternate poses')}</button><label class="field"><input type="checkbox" data-arrows> ${L('ลูกศรการเคลื่อนไหว','Movement arrows')}</label><div class="illustration-crossfade" hidden>${['start','finish'].map(p=>`<img loading="lazy" src="${esc(row[p])}" alt="${esc(L(ex.name))}">`).join('')}</div><p class="note">${L('ภาพประกอบ AI','AI illustration')} - ${esc(row.tool || row.model)}</p>`;
}
export async function mountExerciseVisual(root,ex,{fetcher=globalThis.fetch}={}) {
  const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),reduced=()=>!!motion?.matches;
  root.innerHTML=`<div class="seg visual-toggle"><button class="chip" data-mode="animation">${L('แอนิเมชัน','Animation')}</button><button class="chip" data-mode="pair">${L('เริ่ม–จบ','Start–Finish')}</button></div><div class="exercise-visual"></div>`;
  const host=root.querySelector('.exercise-visual'),nav=root.querySelector('.visual-toggle');
  let anim,timer,row,mode=reduced()?'pair':'animation',stopped=false,touched=false;
  const cleanup=()=>{anim?.stop();clearInterval(timer);};
  const draw=()=>{
    cleanup();if(stopped)return;
    nav.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('on',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    if(mode==='ai'&&row){
      host.innerHTML=illustrationHTML(ex,row);
      host.querySelectorAll('img').forEach(img=>img.onerror=()=>{row=null;nav.querySelector('[data-mode="ai"]')?.remove();mode=reduced()?'pair':'animation';draw();});
      const fade=host.querySelector('.illustration-crossfade');
      const alternate=()=>{fade.hidden=false;fade.classList.toggle('finish');};
      host.querySelector('[data-crossfade]').onclick=alternate;
      host.querySelectorAll('.illustration-frame').forEach(frame=>{frame.setAttribute('role','button');frame.tabIndex=0;frame.setAttribute('aria-label',host.querySelector('[data-crossfade]').textContent);frame.onclick=alternate;frame.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();alternate();}};});
      host.querySelector('[data-arrows]').onchange=e=>host.classList.toggle('show-arrows',e.target.checked);
      if(!reduced()){fade.hidden=false;timer=setInterval(()=>{if(!root.isConnected){cleanup();return;}if(!document.hidden)fade.classList.toggle('finish');},1000);}
    } else if(mode==='pair'||reduced())host.innerHTML=startFinishHTML(ex);
    else anim=animateFigure(host,ex);
  };
  nav.onclick=e=>{const b=e.target.closest('[data-mode]');if(b){touched=true;mode=b.dataset.mode;draw();}};
  const changed=()=>{if(reduced())mode='pair';draw();};motion?.addEventListener?.('change',changed);
  const observer=new MutationObserver(()=>{if(!root.isConnected){stopped=true;cleanup();observer.disconnect();motion?.removeEventListener?.('change',changed);}});
  observer.observe(document.body,{childList:true,subtree:true});draw();
  row=(await loadIllustrations(fetcher))[ex.id];
  if(row&&!stopped&&root.isConnected){nav.insertAdjacentHTML('afterbegin',`<button class="chip" data-mode="ai">${L('ภาพประกอบ AI','AI illustration')}</button>`);if(!touched&&!reduced())mode='ai';draw();}
  return {stop(){stopped=true;cleanup();observer.disconnect();motion?.removeEventListener?.('change',changed);}};
}
