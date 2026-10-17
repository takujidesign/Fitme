# FitMe

Mobile-first PWA (ติดตั้งเป็นแอปได้) สำหรับวางแผน **ออกกำลังกาย + อาหาร + อาหารเสริม + การพักผ่อน** เฉพาะบุคคล ภาษาไทย/อังกฤษ

## ฟีเจอร์

| ส่วน | รายละเอียด |
|---|---|
| โปรไฟล์ | อายุ เพศ ส่วนสูง น้ำหนัก น้ำหนักเป้าหมาย · ผลสแกน InBody (ไขมัน %, กล้ามเนื้อ, BMR) · รูปร่างก่อน/หลัง (เก็บในเครื่องเท่านั้น) · กราฟน้ำหนัก |
| คำนวณพลังงาน | BMR: ค่าจากเครื่องสแกน → Katch-McArdle (ถ้ามีไขมัน %) → Mifflin-St Jeor · TDEE ตามจำนวนวันฝึก · แคลอรี่วันฝึก/วันพักต่างกัน · BMI เกณฑ์เอเชีย |
| ออกกำลังกาย | 30 ท่า มีแอนิเมชันโครงกระดูก 2D (inverse kinematics) · แผนตามจำนวนวัน/สัปดาห์ (Full body / Upper-Lower / PPL) · บ้าน / ดัมเบล / ยิม · Progressive overload + Deload ทุกสัปดาห์ที่ 4 · ตัวจับเวลา เซ็ต/พัก เสียงเตือน |
| อาหาร | ฐานข้อมูลอาหารไทย 45 รายการ · คำนวณกรัมต่อมื้อให้ตรงโปรตีน/คาร์บ/ไขมัน · 3-6 มื้อ/วัน จัดเวลาก่อน/หลังออกกำลังกาย · มังสวิรัติ วีแกน ฮาลาล คาร์บต่ำ · ตัดหมวด เช่น ไม่ทานผลไม้ แพ้ถั่ว · สุ่มเมนูใหม่ |
| อาหารเสริม | ตารางทานตามฉลากจริง (ตามน้ำหนัก วันฝึก/วันพัก Loading/Maintenance) · 8 ผลิตภัณฑ์จากรูปตั้งต้น · อัปโหลดรูปฉลาก → AI (Claude) อ่านวิธีทาน · กรอกเอง · คำนวณวันหมด · เตือนวิตามินซ้ำซ้อน · โปรตีนจากเวย์ถูกหักจากมื้ออาหาร |
| พักผ่อน | ชั่วโมงนอนตามอายุ · เวลาเข้านอนตามรอบ 90 นาที · บันทึกการนอน · งดคาเฟอีน/ปิดจอ ในไทม์ไลน์ · วันพักฟื้น |
| ไทม์ไลน์วันนี้ | รวมทุกอย่างเป็นตารางเวลาเดียว ติ๊กทำแล้ว · วงแหวนแคลอรี่/โปรตีน/น้ำ |
| รายได้ | ฟรี 3 วันแรก + อาหารเสริม 2 รายการ · Pro 30/90 วัน · ซื้อดาวน์โหลดครั้งเดียว · PromptPay QR + ตรวจสลิปด้วย Thunder API · Stripe (บัตร/Apple Pay/Google Pay ทั่วโลก) |
| ดาวน์โหลด | PDF (ผ่านหน้าพิมพ์) · ปฏิทิน .ics พร้อมแจ้งเตือน · สำรอง/กู้คืน JSON |

## โครงสร้าง

```
app/      เว็บแอป (static, ไม่ต้อง build) → GitHub Pages
  js/     calc, workout, exercises+figure (แอนิเมชัน), foods+meals, supplements, day (ไทม์ไลน์), pay, export, views/
worker/   Cloudflare Worker: ตรวจสลิป Thunder, Stripe Checkout, AI อ่านฉลาก (Claude)
```

## รันในเครื่อง

```bash
python -m http.server 5173 --directory app
```

เปิด http://localhost:5173 — ถ้า `API_BASE` ใน `app/js/config.js` ว่าง แอปจะอยู่ใน **โหมดทดลอง** (จ่ายเงินแบบจำลอง, ปิด AI)

## Deploy

### 1. เว็บแอป (GitHub Pages)
1. Push repo ขึ้น GitHub (branch `main`)
2. Settings → Pages → Source: **GitHub Actions**
3. ทุกครั้งที่ push โฟลเดอร์ `app/` จะ deploy อัตโนมัติ (`.github/workflows/pages.yml`)

### 2. API (Cloudflare Worker) — สำหรับรับเงินจริงและ AI
```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put TOKEN_SECRET        # สุ่มข้อความยาว 32+ ตัว
npx wrangler secret put THUNDER_API_KEY     # จาก thunder.in.th
npx wrangler secret put STRIPE_SECRET_KEY   # sk_test_... หรือ sk_live_...
npx wrangler secret put ANTHROPIC_API_KEY   # สำหรับ AI อ่านฉลาก
npx wrangler deploy
```
แล้วแก้ `app/js/config.js`:
- `API_BASE` = URL ของ worker เช่น `https://fitme-api.<account>.workers.dev`
- `PROMPTPAY_ID` = เบอร์พร้อมเพย์/เลขผู้เสียภาษีของคุณ
- ใน `worker/wrangler.toml` ตั้ง `ALLOWED_ORIGINS` เป็นโดเมน Pages และ `RECEIVER_NAME` เป็นชื่อบัญชีผู้รับ (กันสลิปโอนให้คนอื่น)

ราคาสินค้าอยู่สองที่: `app/js/config.js` และ `worker/src/index.js` (`PRODUCTS`) ต้องตรงกัน

## ข้อควรรู้
- ข้อมูลทั้งหมด (รวมรูปร่างกาย) เก็บในเบราว์เซอร์ของผู้ใช้ (localStorage + IndexedDB) ไม่ส่งขึ้นเซิร์ฟเวอร์ ยกเว้นรูปสลิปและรูปฉลากที่ผู้ใช้ส่งตรวจ
- สิทธิ์ Pro เป็น token ที่ server เซ็นไว้ แต่การล็อกฟีเจอร์ทำฝั่งเครื่อง ผู้ที่แก้โค้ดในเบราว์เซอร์เลี่ยงได้ ถ้าต้องการกันจริงให้ย้ายการสร้างแผนไปฝั่ง server
- คำแนะนำในแอปเป็นข้อมูลทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์
