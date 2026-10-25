export function healthAdjustment(target,health){const extra=Math.floor(Math.min(Math.max(0,health?.active_kcal||0),target.tdee*0.3));return {extra,kcal:Math.max(target.bmr,target.kcal+extra)};}
export function healthCheckin(checkin,health,baseline){if(!health)return checkin;return {...checkin,...(health.sleep_min!=null?{sleep:health.sleep_min/60}:{}),...(health.resting_hr!=null&&baseline?{hrPenalty:Math.max(0,Math.min(25,(health.resting_hr-baseline)*2))}:{})};}

export function dailyHealthCheckin(logs,iso){const hrs=Object.entries(logs).filter(([date,l])=>date<iso&&l.health?.resting_hr).sort(([a],[b])=>b.localeCompare(a)).slice(0,7).map(([,l])=>l.health.resting_hr);return healthCheckin(logs[iso]?.checkin,logs[iso]?.health,hrs.length?hrs.reduce((a,b)=>a+b,0)/hrs.length:null);}
