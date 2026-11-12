# ZynerNova Ultra AI — คู่มือติดตั้งและเชื่อมต่อ

โปรเจกต์ใช้ HTML/CSS/Vanilla JS สำหรับหน้าประเมิน และ Node.js built-in HTTP server สำหรับ API/หลังบ้าน จึงไม่ต้องติดตั้ง dependency เพิ่ม แต่ต้องมี Node.js 20.6 ขึ้นไปเพื่อรันระบบเต็ม

## โครงสร้างหลัก

```text
index.html / styles.css / app.js   เว็บประเมินและรายงาน
admin.html / admin.css / admin.js  หลังบ้านสำหรับ Lead, Model และ Knowledge Base
server.js                          Static server + API + JSON storage
knowledge/knowledge-base.json      ความรู้เริ่มต้นสำหรับ keyword retrieval
assets/                            โลโก้และรูป Ultra
DATA_DIR/                          JSON และไฟล์แนบ private (อยู่นอก Git)
```

## การตั้งค่า/เริ่มระบบ

1. คัดลอก `.env.example` เป็น `.env`
2. ตั้ง `ADMIN_PASSWORD` ให้แข็งแรงและสร้าง `APP_SECRET` ใหม่อย่างน้อย 32 bytes ด้วย `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`
3. ตั้งค่า `BASE_PATH=/ai`, `DATA_DIR` เป็นพื้นที่ persistent/private และ `NODE_ENV=production` เมื่อนำขึ้นจริง
4. รัน `npm start`; หน้าเว็บคือ `/ai/`, หลังบ้านคือ `/ai/admin/`
5. ตั้งค่า Base URL, Model, API key และ System Prompt ผ่านหลังบ้าน หรือใช้ `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` เป็น Environment variables

ห้ามนำ `.env`, `data/`, API key หรือข้อมูลลูกค้าขึ้น GitHub

## การฝัง iframe

ค่าเริ่มต้นอนุญาตให้ฝังจาก origin เดียวกันเท่านั้น หากต้องฝังจากเว็บ parent คนละ origin ให้ตั้ง Environment `FRAME_ANCESTORS` เป็นรายการ origin ที่เชื่อถือได้ เช่น `FRAME_ANCESTORS="'self' https://www.zynernova.com"` แล้วทดสอบ CSP ก่อน Deploy

```html
<iframe
  src="/ai/"
  title="ZynerNova AI ประเมินโซลาร์"
  style="width: 100%; min-height: 820px; border: 0; border-radius: 24px;"
  loading="lazy"></iframe>
```

หากหน้า parent ต้องรับ lead event ให้แก้ meta tag ใน `index.html` เป็น exact origin (ห้ามใช้ wildcard):

```html
<meta name="zynernova-parent-origin" content="https://www.zynernova.com" />
```

จากนั้นเพิ่ม listener ในหน้า parent:

```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://www.zynernova.com') return;
  if (event.data?.type === 'ZYNERNOVA_LEAD') {
    // event.data.payload มีข้อมูล Lead; ใช้เฉพาะระบบที่ได้รับอนุญาต
  }
});
```

ตัวเว็บส่ง `postMessage` เฉพาะเมื่อกำหนด meta `zynernova-parent-origin` และใช้ target origin แบบเจาะจง

## API ที่ใช้ในหน้าเว็บ

ทุก API อยู่ใต้ subpath ปัจจุบัน เช่น `/ai/api/...`:

- `GET /api/health` — ตรวจสถานะ backend/AI โดยไม่คืนค่า secret
- `POST /api/assistant` — ขอคำถามถัดไปภาษาไทยจาก Model
- `POST /api/chat` — คำถามเพิ่มเติมหลังจบการประเมิน
- `POST /api/attachments` — รับไฟล์หลังได้รับ consent
- `POST /api/leads` — บันทึก Lead และข้อมูลการคัดกรองเป็น JSON
- `/api/admin/*` — API หลังบ้าน ต้องมี session ผู้ดูแล

ไฟล์แนบสูงสุด 8 MB ต่อไฟล์ รับ JPEG/PNG/WebP, audio, PDF และ text/plain; PDF ยังจัดเก็บ/ดาวน์โหลดได้เท่านั้น ยังไม่มีการอ่านเนื้อหาอัตโนมัติ ไฟล์ที่ส่งเข้า AI ใช้ provider ที่ตั้งค่าไว้และควรตรวจสอบนโยบาย data retention ของ provider ก่อนเปิดใช้งาน

## การจัดการหลังบ้าน

- รหัสผ่านมาจาก `ADMIN_PASSWORD`; ไม่มีรหัสผ่านเริ่มต้น
- session ใช้ cookie HttpOnly, SameSite=Strict และเก็บใน memory (รีสตาร์ตแล้ว session หมดอายุ)
- ตั้ง key ผ่านหน้า Admin ได้เมื่อมี `APP_SECRET`; key ถูกเข้ารหัส AES-256-GCM ใน `DATA_DIR/settings.json` และแสดงกลับเพียงสถานะ/ท้าย 4 ตัว
- ตั้ง `AI_API_KEY` ผ่าน Environment ได้เช่นกัน; ค่า Environment มีลำดับสูงกว่า key ใน JSON
- Lead, ผลคำนวณ, ประวัติข้อความ, metadata และไฟล์แนบเก็บใน `DATA_DIR` ไม่ควรวางไว้ใน public static directory
- JSON storage เหมาะกับ prototype/งานปริมาณต่ำเท่านั้น; ก่อนเปิดใช้งานจริงควรวาง persistent volume, ทำ backup, กำหนด retention, ควบคุมสิทธิ์ และเพิ่มการ monitor disk/error

## RAG และความถูกต้อง

Knowledge Base แก้ได้ที่หลังบ้านหรือไฟล์ต้นทาง `knowledge/knowledge-base.json` ระบบค้นคืนด้วย keyword ranking แล้วใส่ข้อมูลที่เกี่ยวข้องเข้า prompt; ยังไม่มี embedding/vector search เอกสารที่ `reviewStatus: "needs-review"` จะถูกระบุให้ Model ย้ำว่าต้องตรวจสอบ

ตัวเลขราคา/คืนทุน/ภาษี/เงินสนับสนุนในหน้าเว็บเป็นค่าจำลองจาก handoff ไม่ใช่ข้อมูลที่รับรองโดยหน่วยงาน จึงต้องผ่านการตรวจสอบทางธุรกิจ/กฎหมายก่อนนำเสนอจริง
