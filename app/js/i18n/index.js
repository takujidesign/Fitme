import round6 from './round6.js';
import zh from './zh.js';
import ja from './ja.js';
import vi from './vi.js';
export const dictionaries={zh,ja,vi};
for(const [lang,dict] of Object.entries(round6))Object.assign(dictionaries[lang],dict);
export const LANGUAGES={th:'ไทย',en:'English',zh:'中文',ja:'日本語',vi:'Tiếng Việt'};
export const LOCALES={th:'th-TH',en:'en-US',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'};
const templates=Object.fromEntries(Object.entries(dictionaries).map(([lang,dict])=>[lang,Object.keys(dict).filter(key=>/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length).map(key=>{
 const order=[...key.matchAll(/\{(\d+)\}/g)].map(m=>m[1]);
 const pattern=key.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?'(.+?)':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
 return {pattern:new RegExp('^'+pattern+'$'),order,value:dict[key]};
})]));
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
