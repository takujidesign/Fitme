import {getState,setState,todayISO} from '/js/store.js';
import {POLICY_VERSION} from '/js/legal.js';
import {CONFIG} from '/js/config.js';
CONFIG.API_BASE='';
const options=new URL(location.href).searchParams,errors=[];
addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
setState(s=>{
  s.onboarded=true;s.telemetry=false;s.account.token=null;s.lang=options.get('lang')||'th';s.theme=options.get('theme')||'dark';
  s.consents={terms:'local-qa',health:'local-qa',version:POLICY_VERSION};
  s.profile.startDate=todayISO();s.profile.trainDays=[0,1,2,3,4,5,6];s.profile.name='';
  if(!options.has('keep'))Object.assign(s.profile,{styles:['bodyweight'],trainingConfigured:false,equipment:null,focusMuscles:[],focus:[],preferEx:[],avoidEx:[],sessionMin:45,location:'home',trainingHistory:[]});
});
await import('/js/app.js');
const {views,actions,rerender}=await import('/js/core.js');
const pause=()=>new Promise(r=>setTimeout(r,140));
if(options.has('audit')){
  const results=[];
  for(const lang of ['th','en','zh','ja','vi'])for(const theme of ['dark','light']){
    setState(s=>{s.lang=lang;s.theme=theme;});
    for(const name of Object.keys(views).filter(n=>!['player','line-return'].includes(n))){
      location.hash='#/'+name;await pause();rerender();await pause();
      results.push({lang,theme,name,overflow:document.documentElement.scrollWidth>innerWidth+1});
    }
  }
  document.body.innerHTML='<pre id="qa-results"></pre>';
  document.getElementById('qa-results').textContent=JSON.stringify({width:innerWidth,checks:results.length,errors,overflows:results.filter(r=>r.overflow)},null,2);
}else{
  const screen=options.get('screen')||'today';
  location.hash='#/'+(screen==='readiness'?'today':screen==='swap'?'workout':screen);
  await pause();rerender();await pause();
  if(screen==='readiness')actions.checkin({dataset:{iso:todayISO()}});
  if(screen==='swap')actions['exercise-swap']({dataset:{iso:todayISO(),index:'2'}});
  await pause();
  await new Promise(r=>setTimeout(r,700));
  document.body.dataset.qaReady=screen;
  const report=document.createElement('output');report.id='qa-errors';report.hidden=true;report.textContent=JSON.stringify(errors);document.body.append(report);
}
