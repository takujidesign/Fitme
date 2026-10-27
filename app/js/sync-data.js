// Shared wire format: never send local credentials, notifications or image references.
export const syncKeys = ['onboarded','onboardedAt','lang','theme','exerciseVisualStyle','voiceCoach','restDefault','settings','notificationPrefs','mealOverrides','mealPrep','dailyMenus','menuTemplates','shoppingChecks','suggestionDecisions','colours','consents','profile','logs','supplements','weights','measurements','customFoods','foodLog','premium','chat','challenges','badges','blocks','dayOverrides','exSwaps','mealSeed'];
const forbidden = new Set(['photos','photoId','image','images','photo','dataUrl','account','password','geminiKey','openaiKey','kieKey','apiKey','token_hash','__proto__','constructor','prototype']);
export function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !forbidden.has(k)).map(([k,v]) => [k,clean(v)]));
  if (typeof value === 'string' && /^data:image\//i.test(value)) return '';
  return value;
}
export function syncCopy(s) { return clean(Object.fromEntries([...syncKeys,'updatedAt'].filter(k => s[k] !== undefined).map(k => [k,s[k]]))); }
export const hasRealData=s=>['logs','foodLog','weights','measurements','supplements','customFoods','dailyMenus'].some(k=>Object.keys(s[k]||{}).length);
export const pristine=(s,now=Date.now())=>!s.onboarded||(!Object.keys(s.logs||{}).length&&!Object.keys(s.foodLog||{}).length&&now-Number(s.onboardedAt||0)<600000);
export function syncStats(s){const copy=syncCopy(s),counts=Object.fromEntries(['logs','foodLog','weights','measurements','supplements','customFoods','challenges','dailyMenus'].map(k=>[k,Object.values(copy[k]||{}).filter(v=>v!==null).length]));counts.foodLog+=Object.values(copy.logs||{}).reduce((n,l)=>n+(l.foodLog?.length||0),0);return {bytes:new TextEncoder().encode(JSON.stringify(copy)).length,counts};}
const time = (s,k,v) => Number(v?.updatedAt || s.updatedAt?.[k]) || 0;
export function mergeState(local, remote) {
  const result = syncCopy(remote); result.updatedAt = { ...remote.updatedAt };
  for (const k of syncKeys) {
    const a = local[k], b = remote[k];
    if (a === undefined) continue;
    const newer = (x,y) => time(local,k,x) > time(remote,k,y) ? x : y;
    if (['logs','foodLog','dailyMenus','menuTemplates'].includes(k)) {
      result[k] = { ...b };
      for (const [id,v] of Object.entries(a || {})) result[k][id] = b?.[id] === undefined ? v : newer(v,b[id]);
    } else if (['supplements','weights','measurements','customFoods'].includes(k)) {
      const id = v => v.uid || v.id || v.date;
      const rows = new Map((b || []).map(v => [id(v),v]));
      for (const v of a || []) rows.set(id(v), rows.has(id(v)) ? newer(v,rows.get(id(v))) : v);
      result[k] = [...rows.values()];
    } else result[k] = b === undefined ? a : newer(a,b);
    result.updatedAt[k] = Math.max(time(local,k),time(remote,k));
  }
  return syncCopy(result);
}
