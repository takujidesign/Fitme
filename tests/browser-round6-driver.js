import {getState,setState,todayISO} from '/js/store.js';
import {POLICY_VERSION} from '/js/legal.js';
import {CONFIG} from '/js/config.js';
CONFIG.API_BASE='';
const errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
setState(s=>{s.onboarded=true;s.telemetry=false;s.consents={terms:'test-fixture',health:'test-fixture',version:POLICY_VERSION};s.profile.startDate=todayISO();});
await import('/js/app.js');
const {rerender,views}=await import('/js/core.js');
const only=new URL(location.href).searchParams.get('only');
const results=[],pause=()=>new Promise(r=>setTimeout(r,80));
for(const lang of ['th','en','zh','ja','vi'])for(const theme of ['light','dark']){
 setState(s=>{s.lang=lang;s.theme=theme;});
 for(const name of (only?only.split(','):Object.keys(views))){
  location.hash='#/'+name;await pause();rerender();await pause();
  const overflow=document.documentElement.scrollWidth>innerWidth+1;
  results.push({lang,theme,name,overflow});
 }
}
const failures=results.filter(r=>r.overflow);parent.postMessage({round6:true,text:JSON.stringify({checks:results.length,width:innerWidth,errors,overflow:failures},null,2)},location.origin);
setState(s=>{s.lang='th';s.theme='dark';});location.hash='#/muscles';
