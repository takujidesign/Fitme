import {L} from './ui.js';
export function friendlyError(error){
 const messages={
  unsupported_image:['ชนิดรูปภาพไม่รองรับ กรุณาเลือกรูป JPEG หรือ WebP','Unsupported image. Choose a JPEG or WebP photo'],
  image_too_large:['รูปภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง','Image is too large. Choose a smaller photo'],
  email_not_verified:['กรุณายืนยันอีเมลก่อนอัปโหลดหรือส่งข้อความ','Verify your email before uploading or messaging'],
  beta_disabled:['ฟีเจอร์นี้ยังไม่เปิดให้ใช้ในช่วงเบตา','This feature is unavailable during beta'],
  handle_invalid:['ใช้ a–z, 0–9, _ และ . ยาว 3–20 ตัว','Use a–z, 0–9, _ and .; 3–20 characters'],
  handle_reserved:['ชื่อนี้สงวนไว้ กรุณาเลือกชื่ออื่น','This handle is reserved. Choose another'],
  handle_taken:['ชื่อนี้มีผู้ใช้แล้ว กรุณาเลือกชื่ออื่น','This handle is already taken. Choose another'],
  invalid_email:['กรุณากรอกอีเมลที่ถูกต้อง','Enter a valid email address'],
  password_length:['รหัสผ่านต้องยาว 10 ถึง 256 ตัวอักษร','Password must be 10 to 256 characters'],
  no_credits:['เครดิต AI หมด กรุณาเติมเครดิต','No AI credits remaining. Please add credits']
 };
 if(messages[error?.code])return L(...messages[error.code]);
 if(error?.status===401)return L('ยังไม่ได้เข้าสู่ระบบ','Please sign in first');
 if(error?.status>=400&&error.status<500&&error.message&&error.message!=='Request failed')return error.message;
 if(globalThis.navigator?.onLine===false)return L('ออฟไลน์อยู่ — จะลองใหม่เมื่อออนไลน์','You are offline — try again when connected');
 if(error instanceof TypeError||/fetch|network|timeout|server/i.test(error?.message||''))return L('เซิร์ฟเวอร์ไม่ตอบ กรุณาลองใหม่','The server is not responding. Please try again');
 return L('ทำรายการไม่สำเร็จ กรุณาลองใหม่','Could not complete the request. Please try again');
}
