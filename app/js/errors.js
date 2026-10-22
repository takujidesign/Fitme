import {L} from './ui.js';
export function friendlyError(error){
 if(error?.status===401)return L('ยังไม่ได้เข้าสู่ระบบ','Please sign in first');
 if(globalThis.navigator?.onLine===false)return L('ออฟไลน์อยู่ — จะลองใหม่เมื่อออนไลน์','You are offline — try again when connected');
 if(error instanceof TypeError||/fetch|network|timeout|server/i.test(error?.message||''))return L('เซิร์ฟเวอร์ไม่ตอบ กรุณาลองใหม่','The server is not responding. Please try again');
 return L('ทำรายการไม่สำเร็จ กรุณาลองใหม่','Could not complete the request. Please try again');
}
