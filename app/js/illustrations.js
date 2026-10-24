import { getState } from './store.js';
import { photoHTML } from './exercise-library.js';
import { L, esc } from './ui.js';
import { animateFigure, startFinishHTML, arrowSVG } from './figure.js';
import {CONFIG} from './config.js';

export function approvedIllustrations(value) {
  if(!value || typeof value !== 'object' || Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([id,row])=>/^[a-z0-9_-]+$/i.test(id) && row?.source==='ai' && ['start','finish'].every(p=>[ `img/ex/${id}-${p}.webp`, `img/ex/${id}-${p}-round11.webp` ].includes(row[p])) && (row.tool==='Codex image generation' || typeof row.model==='string') && typeof row.created==='string'));
}
export async function loadIllustrations(fetcher=globalThis.fetch) {
  let result={};try {const r=await fetcher(new URL('../data/illustrations.json',import.meta.url));if(r.ok)result=approvedIllustrations(await r.json());} catch {}
  if(CONFIG.API_BASE)try{const base=CONFIG.API_BASE.replace(/\/$/,''),r=await fetcher(base+'/api/feed/illustrations');if(r.ok)for(const row of (await r.json()).items||[])if(/^[a-z0-9_-]+$/.test(row.id)&&Number.isFinite(row.updated))result[row.id]={source:'admin',model:'Admin reviewed upload',created:new Date(row.updated).toISOString(),start:base+'/api/feed/illustrations/'+row.id+'/start?v='+row.updated,finish:base+'/api/feed/illustrations/'+row.id+'/finish?v='+row.updated};}catch{}
  return result;
}
export function illustrationHTML(ex,row) {
  return `<div class="illustration-pair">${['start','finish'].map((pose,i)=>`<figure><div class="illustration-frame"><img loading="lazy" src="${esc(row[pose])}" alt="${esc(L(ex.name))} - ${i?L('จบ','Finish'):L('เริ่ม','Start')}"><svg class="illustration-arrow" viewBox="0 0 200 200" aria-hidden="true">${arrowSVG(ex)}</svg></div><figcaption>${i?L('จบ','Finish'):L('เริ่ม','Start')}</figcaption></figure>`).join('')}</div><button type="button" class="btn ghost" data-crossfade>${L('สลับภาพ','Alternate poses')}</button><label class="field"><input type="checkbox" data-arrows> ${L('ลูกศรการเคลื่อนไหว','Movement arrows')}</label><div class="illustration-crossfade" hidden>${['start','finish'].map(p=>`<img loading="lazy" src="${esc(row[p])}" alt="${esc(L(ex.name))}">`).join('')}</div><p class="note">${L('ภาพประกอบ AI','AI illustration')} - ${esc(row.tool || row.model)}</p>`;
}
export async function mountExerciseVisual(root,ex,{fetcher=globalThis.fetch}={}) {
  if(!ex.frames){root.innerHTML=photoHTML(ex);return {stop(){}};}
  const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),reduced=()=>!!motion?.matches;
  root.innerHTML=`<div class="seg visual-toggle"><button class="chip" data-mode="animation">${L('แอนิเมชัน','Animation')}</button><button class="chip" data-mode="pair">${L('เริ่ม–จบ','Start–Finish')}</button></div><div class="exercise-visual"></div>`;
  const host=root.querySelector('.exercise-visual'),nav=root.querySelector('.visual-toggle');
  let anim,timer,row,flat,three,mode=reduced()?'pair':'animation',stopped=false,touched=false;
  const cleanup=()=>{anim?.stop();clearInterval(timer);};
  const draw=()=>{
    cleanup();if(stopped)return;
    nav.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('on',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    row=mode==='3d'?three:flat;
    if((mode==='ai'||mode==='3d')&&row){
      host.innerHTML=illustrationHTML(ex,row);
      host.querySelectorAll('img').forEach(img=>img.onerror=()=>{if(mode==='3d'){three=null;nav.querySelector('[data-mode="3d"]')?.remove();mode=flat?'ai':reduced()?'pair':'animation';}else{flat=null;nav.querySelector('[data-mode="ai"]')?.remove();mode=reduced()?'pair':'animation';}draw();});
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
  const values=await Promise.all([loadIllustrations(fetcher),load3DIllustrations(fetcher)]);flat=values[0][ex.id];three=values[1][ex.id];row=flat;
  if(row&&!stopped&&root.isConnected){nav.insertAdjacentHTML('afterbegin',`<button class="chip" data-mode="ai">${L('ภาพประกอบ AI','AI illustration')}</button>`);if(!touched&&!reduced()&&getState().exerciseVisualStyle!=='animation')mode='ai';draw();}
  if(three&&!stopped&&root.isConnected){nav.insertAdjacentHTML('afterbegin','<button class="chip" data-mode="3d">3D</button>');if(!touched&&(getState().exerciseVisualStyle||'3d')==='3d')mode='3d';draw();}
  return {stop(){stopped=true;cleanup();observer.disconnect();motion?.removeEventListener?.('change',changed);}};
}

export function approved3D(value){return Object.fromEntries(Object.entries(value||{}).filter(([id,row])=>/^[a-z0-9_]+$/.test(id)&&row?.style==='3d'&&row.tool==='Codex image generation'&&typeof row.created==='string'&&['start','finish'].every(p=>row[p]===`img/ex3d/${id}-${p}.webp`)));}
export async function load3DIllustrations(fetcher=globalThis.fetch){try{const r=await fetcher(new URL('../data/illustrations-3d.json',import.meta.url));return r.ok?approved3D(await r.json()):{};}catch{return {};}}
