export const privateTitle=lang=>({th:'Fixmee: ถึงเวลาแล้ว',en:'Fixmee: reminder due',zh:'Fixmee: 提醒时间到了',ja:'Fixmee: リマインダーの時間です',vi:'Fixmee: Đã đến giờ nhắc nhở'}[lang]||'Fixmee: reminder due');
export function privateReminder(r,prefs={}){const mode=prefs.privacy??'medications';return mode==='all'||mode==='medications'&&r.category==='medications'?{...r,title:privateTitle(prefs.lang),body:''}:r;}
