import {featureUsed} from './telemetry.js';
import {activeEngine,engineRequest} from './ai-engines.js';
import {providerKey} from './byok.js';
import {api} from './account.js';
import {aiToken} from './ai-credits.js';
import {installId} from './install-id.js';
import {requireIntegration} from './beta.js';
export function pickMealTier({preferred=activeEngine(),hasKey=p=>!!providerKey(p),highAccuracy=false}={}){if(highAccuracy||preferred==='claude')return {tier:'credits',provider:'claude'};const own=[preferred,...['gemini','openai','kie'].filter(p=>p!==preferred)].find(p=>['gemini','openai','kie'].includes(p)&&hasKey(p));return own?{tier:'byok',provider:own}:{tier:'free',provider:'Workers AI → Groq'};}
export const identity=()=>({installId:installId(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
export const mealQuota=()=>api('ai/free-status',identity());
export async function requestMeal(body,choice=pickMealTier()){
 if(choice.tier==='byok'){try{return await engineRequest('ai/meal-photo',body,{engine:choice.provider});}catch(e){if(!/Cancelled|ยกเลิก/.test(e.message))featureUsed('byok_'+choice.provider+'_error');throw e;}}
 requireIntegration('mealPhoto');
 // Explicit allowlist: never forward keys, summaries, RepDB data or profile data.
 const clean={images:body.images,note:body.note||'',lang:body.lang};
 return choice.tier==='free'?api('ai/meal-photo?tier=free',{...clean,...identity()}):api('ai/meal-photo',clean,'POST',aiToken());
}
export const privacy={
 th:'คีย์ของคุณ: ส่งรูปและหมายเหตุให้ Google Gemini, OpenAI หรือ kie.ai ที่เลือก (kie อาจผ่านพร็อกซี Fixmee) คีย์เก็บในเครื่อง Google อาจใช้ข้อมูลโควตาฟรีปรับปรุงผลิตภัณฑ์ • โควตาฟรี: Cloudflare Workers AI แล้ว Groq • เครดิต: Anthropic Claude ผ่าน Fixmee เซิร์ฟเวอร์ประมวลผลรูปในหน่วยความจำ ไม่เก็บรูป กรุณาตรวจอาหารก่อนบันทึก',
 en:'Own key: photos and notes go to Google Gemini, OpenAI or kie.ai (kie may use the Fixmee proxy); keys stay on this device. Google may use free-tier data to improve products. Free quota: Cloudflare Workers AI, then Groq. Credits: Anthropic Claude via Fixmee. The server processes images in memory without storing them. Review before saving.',
 zh:'自备密钥：照片和备注发送给所选 Google Gemini、OpenAI 或 kie.ai（kie 可经 Fixmee 代理）；密钥保存在设备上。Google 可能使用免费层数据改进产品。免费配额：Cloudflare Workers AI，然后 Groq。积分：经 Fixmee 使用 Anthropic Claude。服务器仅在内存中处理图片，不保存。保存前请核对。',
 ja:'自分のキー：写真とメモは Google Gemini、OpenAI または kie.ai に送信（kie は Fixmee プロキシを使う場合あり）。キーは端末に保存。Google は無料枠のデータを製品改善に使う場合があります。無料枠：Cloudflare Workers AI、次に Groq。クレジット：Fixmee 経由の Anthropic Claude。サーバーは画像をメモリ内で処理し保存しません。保存前に確認してください。',
 vi:'Khóa riêng: ảnh và ghi chú gửi tới Google Gemini, OpenAI hoặc kie.ai (kie có thể qua proxy Fixmee); khóa lưu trên thiết bị. Google có thể dùng dữ liệu miễn phí để cải thiện sản phẩm. Hạn mức miễn phí: Cloudflare Workers AI rồi Groq. Tín dụng: Anthropic Claude qua Fixmee. Máy chủ xử lý ảnh trong bộ nhớ, không lưu ảnh. Kiểm tra trước khi lưu.'
};
