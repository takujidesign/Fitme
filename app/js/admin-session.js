import { rerender } from './core.js';
export const adminToken = () => {try{return sessionStorage.getItem('fitme:admin-token') || '';}catch{return '';}};
export let adminVerified = false;
export function setAdminSession(token, verified = false) {
  adminVerified = verified;
  try { sessionStorage.removeItem('fitme:admin-password'); if(token)sessionStorage.setItem('fitme:admin-token',token);else sessionStorage.removeItem('fitme:admin-token'); } catch {}
}
export async function adminFetch(url, options = {}) {
  const res = await fetch(url, {...options,headers:{...options.headers,Authorization:'Bearer '+adminToken()}});
  if(res.status===401){setAdminSession('');rerender();}
  return res;
}
