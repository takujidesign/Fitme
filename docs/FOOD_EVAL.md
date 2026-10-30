# ประเมินความแม่นยำภาพอาหาร (เจ้าของรันเอง)

ใช้รูปอาหารของคุณเองประมาณ 50 รูป: อาหารไทยทั่วไป 25 รูป เครื่องดื่ม 10 รูป จานผสม 10 รูป และอาหารบรรจุภัณฑ์ 5 รูป ถ่ายหลายแสงและมุม ไม่ให้ติดใบหน้า ใบเสร็จ หรือข้อมูลส่วนตัว ห้ามใช้ RepDB หรือรูปจาก RepDB

วางรูปใน `food-eval/` ย่อด้านยาวไม่เกิน 768 px และบันทึก JPEG ใหม่เพื่อลบ EXIF ก่อนใช้ รูปและผลลัพธ์ถูก git-ignore ยกเว้น `labels.example.json` ซึ่งไม่มีรูปจริง คัดลอกตัวอย่างเป็น `labels.json` ใส่ชื่ออาหารตามฐานข้อมูล Fixmee และกรัมที่ชั่งจริงต่อรายการตามลำดับ หากไม่ใส่กรัม จะใช้ปริมาณมาตรฐานของอาหาร ซึ่งทำให้ผล kcal เป็นเพียงการเทียบปริมาณมาตรฐาน ไม่ใช่ความถูกต้องจากการชั่ง

ติดตั้ง dependencies ใน worker ก่อน ตั้งค่าคีย์ใน environment เฉพาะ session ห้ามเขียนคีย์ในไฟล์หรือ commit:

- Workers AI: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`; `WORKERS_AI_MODEL` ไม่บังคับ ต้องเปิด Workers AI และยอมรับ license โมเดลก่อน
- Groq: `GROQ_API_KEY`; `GROQ_MODEL` ไม่บังคับ
- Gemini: `GEMINI_API_KEY`; `GEMINI_MODEL` ไม่บังคับ (เริ่มต้น `gemini-2.5-flash`)
- Claude: `ANTHROPIC_API_KEY`; `CLAUDE_MODEL` ไม่บังคับ

รันจากราก repository: `node scripts/food-eval.mjs --run` โปรแกรมส่งรูปเดียวกันให้ทุก engine ที่ตั้งคีย์ไว้ และเขียน `food-eval/results-YYYY-MM-DD.md` ไม่รันใน CI และ import ฟังก์ชันทดสอบไม่ส่งคำขอจริง การรันนี้อาจมีค่าใช้จ่าย ใช้โควตาผู้ให้บริการของเจ้าของโดยตรง ไม่ผ่านตัวจำกัดโควตาแอป

รายงานแสดง top-1 / top-3 จากการจับคู่ชื่อใน `food-match.js`, mean absolute kcal error จากสารอาหารฐานข้อมูล, เวลาเฉลี่ย และราคาโดยประมาณต่อรูป ชื่อใน label ที่หาไม่พบจะรายงานเป็น failed ไม่เดาอาหารแทน ตรวจจำนวน failed ด้วย อย่าเลือกโมเดลจากผลสำเร็จเพียงไม่กี่รูป ค่า kcal เป็นการเทียบฐานข้อมูล ไม่ใช่การวิเคราะห์สารอาหารจริง

ราคา `—` หมายถึงไม่มีข้อมูลอัตราที่เชื่อถือได้ ตั้ง `GROQ_FREE_TIER=1` / `GEMINI_FREE_TIER=1` / `WORKERS_AI_FREE_TIER=1` เฉพาะเมื่อยืนยันว่าโครงการอยู่ในโควตาฟรี ตั้ง `CLAUDE_INPUT_USD_PER_M` และ `CLAUDE_OUTPUT_USD_PER_M` ตามราคาโมเดล ณ วันที่รัน ส่วน Groq ใช้ `GROQ_INPUT_USD_PER_M` / `GROQ_OUTPUT_USD_PER_M` และ token usage จริง หากไม่ใส่อัตราจะแสดง `—`

Gemini 2.5 Flash ใช้ค่าประมาณ input $0.30 / output $2.50 ต่อหนึ่งล้าน token รวม thinking tokens ตาม [ราคาของ Google](https://ai.google.dev/gemini-api/docs/pricing) เปลี่ยนได้ด้วย `GEMINI_INPUT_USD_PER_M` / `GEMINI_OUTPUT_USD_PER_M`; ถ้าเลือกโมเดลอื่นต้องใส่อัตราเอง Workers AI โมเดลเริ่มต้นใช้เพดานประมาณ $0.011 ต่อรูป ไม่ใช่ราคาเรียกเก็บจริง (1,000 neurons ที่จองอย่างระมัดระวัง) โมเดลอื่นจะแสดง `—` ตรวจ dashboard เพิ่มเพราะฟรีรายวันแชร์ทั้งบัญชี ไม่ตีความ `—` เป็นศูนย์

เลือก default free model จาก top-1, kcal error, latency และอัตราล้มเหลวร่วมกัน แยกตรวจอาหารไทย เครื่องดื่ม และจานผสม จากนั้นปรับใน Admin → AI tiers เฉพาะ model ID ที่ผ่าน allowlist ตรวจขอบเขตงบแล้ว การเพิ่มโมเดลใหม่ต้องตรวจ input schema และเพดาน neurons ก่อน ไม่เปลี่ยนเพียงชื่อเพื่อข้ามข้อจำกัดราคา

นโยบายข้อมูล: โควตาฟรี Google อาจใช้ข้อมูลปรับปรุงผลิตภัณฑ์ อ่าน [Google terms](https://ai.google.dev/gemini-api/terms) ก่อนส่งรูป ผู้ประมวลผลอื่นคือ Cloudflare, Groq และ Anthropic ตาม engine ที่เปิด
