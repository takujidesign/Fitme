import {Window} from 'happy-dom';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const window=new Window({url:'http://local/#/today?d=2026-11-02'});
for(const k of ['window','document','localStorage','sessionStorage','navigator','location','history','Event','FormData'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?window:window[k]});
globalThis.requestAnimationFrame=()=>1;globalThis.fetch=async()=>Response.json({});
const {getState,setState}=await import('../app/js/store.js'),{views}=await import('../app/js/core.js');
const {showRoutine,showTimeChange,mountSummary}=await import('../app/js/views/routine.js'),{closeSheet}=await import('../app/js/ui.js');
await import('../app/js/views/today.js');
const iso='2026-11-02',out='docs/round23-screens';await mkdir(out,{recursive:true});
const css=(await readFile('app/css/app.css','utf8')).replace(/@import[^;]+;/g,'');
const host=document.createElement('main');host.id='view';document.body.append(host);
const render=()=>{host.innerHTML=views.today({query:new URLSearchParams('d='+iso)});const summary=host.querySelector('[data-routine-summary]');if(summary)mountSummary(summary,iso);};
const capture=async(name,theme)=>{for(const input of document.querySelectorAll('input')){input.setAttribute('value',input.value);if(input.checked)input.setAttribute('checked','');else input.removeAttribute('checked');}for(const option of document.querySelectorAll('option')){if(option.selected)option.setAttribute('selected','');else option.removeAttribute('selected');}await writeFile(out+'/'+theme+'-'+name+'.fixture.html',`<!doctype html><html lang="th" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=375"><title>Round 23 ${name} DOM fixture</title><style>${css}body{width:375px;margin:0 auto}input,select,fieldset{min-width:0;max-width:100%}.sheet-wrap .sheet{transform:translate(-50%,0);max-width:375px}.sheet-backdrop{opacity:1}.toast{opacity:1;transform:none}</style><body><p>375px DOM fixture. Not a browser screenshot.</p>${document.body.innerHTML}</body></html>`);};
for(const theme of ['light','dark']){
 setState(s=>{s.lang='th';s.theme=theme;s.onboarded=true;s.telemetry=false;s.logs={};s.supplements=[{uid:'b',productId:'vistra_bcomplex',startDate:iso}];Object.assign(s.profile,{startDate:iso,wake:'05:30',bed:'21:30',workoutTime:'17:30',sessionMin:45,mealsPerDay:2,fasting:'none',trainDays:[0,1,2,3,4,5,6],routine:{meals:[{time:'08:10'},{time:'16:30'}],activities:[],weekend:null}});});
 closeSheet(true);render();showRoutine(iso);await capture('routine-example',theme);
 const time=document.querySelector('[data-r="meal:0"]');time.value='05:35';time.dispatchEvent(new Event('input'));await capture('conflict-warning',theme);
 closeSheet(true);render();await capture('today-pinned',theme);
 showTimeChange(iso,'meal-m0');await capture('change-time',theme);
 document.querySelector('[data-r="time"]').value='09:00';document.querySelector('#time-today').click();closeSheet(true);render();await capture('change-toast',theme);
 document.querySelectorAll('.toast').forEach(t=>t.remove());
}
await window.happyDOM.abort();console.log('Saved 10 reviewable DOM fixtures, 375px, both themes. These are not browser screenshots.');
