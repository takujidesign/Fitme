import {getState,setState,todayISO} from './store.js';
import {actions} from './core.js';
import {L,sheet,esc,toast} from './ui.js';
import {TABS,PRESETS,GRADIENTS,gradientPalette,randomPalette,singlePalette,savePalette,restorePalette} from './palettes.js';
import {installId} from './install-id.js';
const supporter=()=>!!localStorage.getItem('fitme:supporter:'+(getState().account?.user?.id||installId()));
export function applyTheme(){
 const s=getState(),el=document.documentElement;el.dataset.theme=['auto','dark','light'].includes(s.theme)?s.theme:'auto';
 const settings=s.colours||{},day=todayISO();
 if(settings.daily&&settings.mode==='random'&&settings.day!==day)setState(v=>{v.colours={...settings,day,palette:randomPalette(Math.random(),settings.palette,settings.locked)};});
 applyAccent();
}
export function applyAccent(){const s=getState(),el=document.documentElement,c=s.colours||{},theme=s.theme==='light'||s.theme==='auto'&&globalThis.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark',pair=c.mode!=='tab'&&c.palette?.[el.dataset.tab||'today']?.[theme];for(const key of ['--accent','--accent-on','--accent-soft','--accent-glow','--accent-gradient'])el.style.removeProperty(key);if(pair){el.style.setProperty('--accent',pair.color);el.style.setProperty('--accent-on',pair.on);el.style.setProperty('--accent-soft',pair.color+'22');el.style.setProperty('--accent-glow',pair.color+'44');if(pair.gradient&&supporter())el.style.setProperty('--accent-gradient',pair.gradient);}}
actions.theme=()=>{const s=getState(),c=s.colours||{};return sheet(`<h2>${L('ธีม','Theme')}</h2><div class="seg">${[['auto','อัตโนมัติ','Automatic'],['dark','มืด','Dark'],['light','สว่าง','Light']].map(([v,th,en])=>`<button class="chip ${s.theme===v?'on':''}" data-theme-value="${v}">${L(th,en)}</button>`).join('')}</div><h3>${L('สีธีม','Theme colours')}</h3><div class="seg">${[['tab','ตามเมนู','Per tab'],['single','สีเดียว','Single colour'],['random','สุ่ม','Random']].map(([v,th,en])=>`<button class="chip ${c.mode===v?'on':''}" data-mode="${v}">${L(th,en)}</button>`).join('')}</div><div class="palette-presets">${PRESETS.map(color=>`<button class="chip" style="background:${color};min-height:44px" aria-label="${color}" data-colour="${color}">●</button>`).join('')}</div><label class="field">${L('เลือกสี','Choose colour')}<input type="color" value="${c.single||'#0284c7'}" id="single-colour"></label><button class="btn primary" data-random>🎲 ${L('สุ่มใหม่','Randomize')}</button><div class="list">${TABS.map(tab=>`<label class="list-row"><input type="checkbox" data-lock="${tab}" ${c.locked?.includes(tab)?'checked':''}>${L('ล็อกสีนี้','Lock colour')} · ${esc(tab)}</label>`).join('')}</div><label class="field"><input type="checkbox" id="daily-colour" ${c.daily?'checked':''}>${L('สุ่มทุกวัน','Randomize daily')}</label><button class="btn ghost" data-save-palette>${L('บันทึกชุดสี','Save palette')} (${(c.saved||[]).length}/5)</button>${(c.saved||[]).map((p,i)=>`<button class="btn ghost" data-restore-palette="${i}">${esc(p.name)}</button>`).join('')}`,{onMount(root){
 if(supporter()){const block=document.createElement('div');block.className='palette-presets';block.innerHTML=GRADIENTS.map((g,i)=>`<button class="chip" data-gradient="${i}">${esc(g.name)}</button>`).join('');root.append(block);block.querySelectorAll('button').forEach(el=>el.onclick=()=>{setState(v=>{v.colours.mode='single';v.colours.palette=gradientPalette(Number(el.dataset.gradient));});applyTheme();});}
 const update=fn=>{setState(v=>{v.colours??={mode:'tab',locked:[],saved:[]};fn(v.colours);});applyTheme();};
 root.querySelectorAll('[data-theme-value]').forEach(el=>el.onclick=()=>{setState(v=>v.theme=el.dataset.themeValue);applyTheme();actions.theme();});
 root.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{update(v=>{v.mode=el.dataset.mode;if(v.mode==='random')v.palette??=randomPalette();if(v.mode==='single')v.palette=singlePalette(v.single||'#0284c7');});actions.theme();});
 const colour=value=>update(v=>{v.mode='single';v.single=value;v.palette=singlePalette(value);});
 root.querySelectorAll('[data-colour]').forEach(el=>el.onclick=()=>colour(el.dataset.colour));root.querySelector('#single-colour').oninput=e=>colour(e.target.value);
 root.querySelector('[data-random]').onclick=()=>{update(v=>{v.mode='random';v.palette=randomPalette(Math.random(),v.palette,v.locked);});root.querySelector('[data-random]').animate?.([{transform:'rotate(0)'},{transform:'rotate(360deg)'}],{duration:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:180});};
 root.querySelectorAll('[data-lock]').forEach(el=>el.onchange=()=>update(v=>v.locked=[...root.querySelectorAll('[data-lock]:checked')].map(e=>e.dataset.lock)));
 root.querySelector('#daily-colour').onchange=e=>update(v=>v.daily=e.target.checked);
 root.querySelector('[data-save-palette]').onclick=()=>{try{setState(v=>{v.colours=savePalette({...v.colours,palette:v.colours?.palette||randomPalette()},L('ชุดสี','Palette')+' '+((v.colours?.saved?.length||0)+1));});actions.theme();}catch{toast(L('บันทึกได้สูงสุด 5 ชุด','Save up to five palettes'));}};
 root.querySelectorAll('[data-restore-palette]').forEach(el=>el.onclick=()=>{setState(v=>v.colours=restorePalette(v.colours,Number(el.dataset.restorePalette)));applyTheme();actions.theme();});
 }});};

globalThis.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(getState().theme==='auto')applyAccent();});
