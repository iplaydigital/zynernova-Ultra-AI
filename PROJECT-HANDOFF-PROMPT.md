# เอกสารส่งต่องาน — ZynerNova Ultra AI

เอกสารนี้สรุปบริบทและสถานะปัจจุบันเพื่อให้ทีมพัฒนาทำงานต่อได้โดยไม่สับสนระหว่างฟีเจอร์ที่ทำแล้วกับสิ่งที่ยังต้องเตรียมก่อนเปิดใช้งานจริง

## เป้าหมายผลิตภัณฑ์

สร้างเว็บประเมินโซลาร์ภาษาไทยของ ZynerNova โดยมีผู้ช่วย “น้อง Ultra ⚡️ AI” ที่ช่วยเก็บข้อมูลความต้องการ คำนวณประมาณการเบื้องต้น สรุป Lead และส่งต่อให้ผู้เชี่ยวชาญ หน้าลูกค้าต้องรองรับการติดตั้งที่ `https://www.zynernova.com/ai/`

## สถานะใน repository ปัจจุบัน

### ทำแล้วใน source code

1. **เว็บประเมินและรายงาน** — `index.html`, `styles.css`, `app.js`; แบบประเมินหลายขั้น, เครื่องคำนวณ On-grid/Hybrid, รายงาน และตัวอย่างข้อมูล
2. **Subpath `/ai/`** — static assets และ API ใช้ relative path; Node server รองรับ `BASE_PATH`
3. **Backend แบบไม่พึ่ง package ภายนอก** — `server.js` ใช้ Node built-ins, API สำหรับ prompt ต่อเนื่อง, คำถามอิสระ, Lead และไฟล์แนบ
4. **JSON storage** — Lead, conversation, settings และ metadata เก็บใต้ `DATA_DIR`; uploads อยู่นอก static route
5. **Admin dashboard** — login ด้วย `ADMIN_PASSWORD`, session cookie HttpOnly/SameSite=Strict, จัดการ Lead/ไฟล์แนบ/Model/System Prompt/Knowledge Base
6. **Model adapter** — OpenAI-compatible Chat Completions; รับภาพเพื่อวิเคราะห์และใช้ `/audio/transcriptions` สำหรับเสียงเมื่อ provider รองรับ
7. **RAG ระยะเริ่มต้น** — `knowledge/knowledge-base.json` ใช้ keyword ranking; ไม่ใช่ vector database หรือ embedding
8. **ความปลอดภัยเบื้องต้น** — API key ที่กรอกจากหลังบ้านเข้ารหัส AES-256-GCM เมื่อกำหนด `APP_SECRET`; ตรวจชนิด/ขนาดไฟล์, ไม่เปิดไฟล์แนบสาธารณะ, ปฏิเสธข้อความที่ไม่มี consent

### ต้องตั้งค่าหรือทำต่อก่อนใช้งานจริง

- ยังไม่มี API key หรือผู้ให้บริการ Model ที่เลือกไว้ ต้องตั้งค่าจาก Admin/Environment และตรวจการส่งข้อมูล/นโยบาย retention ของ provider
- PDF รับฝากและดาวน์โหลดได้ แต่ยังไม่มี OCR/การอ่าน PDF; การวิเคราะห์รูป/เสียงขึ้นกับความสามารถและ endpoint ของ provider
- ต้องทดสอบ Model จริงทั้งภาษาไทย, output จากภาพ/เสียง, timeout, quota และกรณี provider ล่ม
- JSON storage เหมาะกับ prototype/ปริมาณต่ำ; เพิ่ม backup, retention, deletion workflow, audit/monitoring และ persistent volume ก่อนเปิด public
- เพิ่มมาตรการ production ตามโฮสต์: TLS, จำกัดการเข้าถึง Admin, CSRF/origin policy หลัง reverse proxy, log/alert และ restore test
- ตรวจสอบราคา/ประหยัด/ภาษี/เงินสนับสนุน/สินเชื่อกับทีมธุรกิจและกฎหมาย ตัวเลขที่มีในเครื่องคำนวณยังเป็นสมมติฐานจาก handoff และไม่ควรยืนยันกับลูกค้า
- ทบทวนข้อความ privacy/consent และขั้นตอนจัดการสิทธิข้อมูลให้สอดคล้องกับนโยบายจริงขององค์กร/PDPA ก่อนเก็บข้อมูลลูกค้า

## ข้อมูลอ้างอิงจาก handoff เดิม

โทนแบรนด์หลักคือ navy/blue/green; ข้อมูลคำถามประกอบด้วย consent, ค่าไฟ, ช่วงเวลาใช้ไฟ, ทำเล, พื้นที่หลังคา, ฐานภาษี, รูปแบบชำระ, แผนติดตั้ง, ชื่อ และโทรศัพท์ รายงานเดิมมีค่าอ้างอิงตัวอย่าง เช่น แผง 585 W, อัตราค่าไฟและราคาแพ็กเกจ — ให้ถือเป็น placeholder จนกว่าจะตรวจสอบกับเจ้าของผลิตภัณฑ์

## คำสั่งสำหรับงานต่อไป

- อ่าน `README.md` และ `README-INTEGRATION.md` ก่อนแก้ไขการตั้งค่า/Deploy
- ใช้ Node.js 20.6 ขึ้นไป; รันทดสอบด้วย `npm test`
- ห้าม commit `.env`, `data/`, ข้อมูลลูกค้าจริง หรือ API key
- ไม่ใส่ secret ใน HTML/JavaScript ฝั่ง browser
- รักษาการติดตั้งใต้ `/ai/` และอย่าให้ endpoint หรือ asset path หลุดไปที่ root เมื่อ deploy ใต้ subpath
