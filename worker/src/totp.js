// RFC 6238, SHA-1, 30 second steps, six digits. Secret is configured out of band.
export async function totp(secret,time=Date.now()){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=|\s/g,'')){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid TOTP secret');bits+=n.toString(2).padStart(5,'0');}
 const bytes=Uint8Array.from(bits.match(/.{8}/g)||[],b=>parseInt(b,2)),counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(Math.floor(time/30000)));
 const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-1'},false,['sign']),mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),offset=mac.at(-1)&15;
 return String(((mac[offset]&127)*16777216+mac[offset+1]*65536+mac[offset+2]*256+mac[offset+3])%1000000).padStart(6,'0');
}
export async function verifyTOTP(secret,code,time=Date.now()){if(!/^\d{6}$/.test(code||''))return false;let valid=0;for(const shift of [-30000,0,30000]){const expected=await totp(secret,time+shift);let diff=0;for(let i=0;i<6;i++)diff|=expected.charCodeAt(i)^code.charCodeAt(i);valid|=Number(diff===0);}return !!valid;}
