import {CONFIG} from '../config.js';
export const dictionaries={zh:{},ja:{},vi:{}};
const loaded=new Set(['th','en']),pending={};
export const languageLoaded=lang=>loaded.has(lang);
export async function loadLanguage(lang){
 if(loaded.has(lang)||!['zh','ja','vi'].includes(lang))return;
 if(pending[lang])return pending[lang];
 pending[lang]=(async()=>{
  const base=await ({zh:()=>import('./zh.js'),ja:()=>import('./ja.js'),vi:()=>import('./vi.js')})[lang]();
  const rounds=await Promise.all([import('./round6.js'),import('./round7.js'),import('./round9.js'),import('./round10.js'),import('./round11.js'),import('./round12.js'),import('./round13.js'),import('./round14.js'),import('./round15.js'),import('./round16.js'),import('./round17.js')]);
  Object.assign(dictionaries[lang],base.default,...rounds.map(m=>m.default[lang]));
  rebuildTemplates(lang);loaded.add(lang);
 })().catch(error=>{delete pending[lang];throw error;});return pending[lang];
}
export const LANGUAGES={th:'ไทย',en:'English',zh:'中文',ja:'日本語',vi:'Tiếng Việt'};
export const enabledLanguages=()=>Object.entries(LANGUAGES).filter(([id])=>['th','en'].includes(id)||CONFIG.launch?.languages?.[id]===true).map(([id,name])=>[id,name+(['th','en'].includes(id)?'':' · Beta')]);
export const LOCALES={th:'th-TH',en:'en-US',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
const templates={};
function rebuildTemplates(lang){const dict=dictionaries[lang];templates[lang]=Object.keys(dict).filter(key=>/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length).map(key=>{
 const order=[...key.matchAll(/\{(\d+)\}/g)].map(m=>m[1]);
 const pattern=key.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?'(.+?)':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
 return {pattern:new RegExp('^'+pattern+'$'),order,value:dict[key]};
});}
function translated(en,language){
 if(typeof en!=='string')return undefined;
 if(dictionaries[language]?.[en])return dictionaries[language][en];
 for(const template of templates[language]||[]){const match=en.match(template.pattern);if(match){const values=Object.fromEntries(template.order.map((key,i)=>[key,match[i+1]]));return template.value.replace(/\{(\d+)\}/g,(_,key)=>values[key]??'');}}
}
export function translate(value,english,language){
 const object=value&&typeof value==='object',en=object?value.en:english,th=object?value.th:value;
 if(object&&Array.isArray(value.en))return value[language]??value.en.map((v,i)=>translate(value.th?.[i],v,language));
 const selected=object?value[language]:language==='th'?th:language==='en'?en:undefined;
 return selected??translated(en,language)??en??th??'';
}
export function localizedNames(value){for(const lang of ['zh','ja','vi'])if(value.en&&dictionaries[lang][value.en])value[lang]??=dictionaries[lang][value.en];return value;}
export function languageFont(language){
 if(typeof document==='undefined')return;
 document.documentElement.lang=language;
 const font={zh:['Noto Sans SC','Noto+Sans+SC'],ja:['Noto Sans JP','Noto+Sans+JP']}[language];
 document.documentElement.style.setProperty('--language-font',font?`"${font[0]}"`:'"Noto Sans Thai"');
 if(!font||document.getElementById('font-'+language))return;
 const link=document.createElement('link');link.id='font-'+language;link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+font[1]+':wght@400;500;600;700&display=swap';link.onload=()=>import('../offline.js').then(m=>m.cacheOfflineAssets()).catch(()=>{});document.head.append(link);
}
