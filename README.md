# ZynerNova Ultra AI

เว็บประเมินโซลาร์ภาษาไทย พร้อมหน้าแชต/รายงาน, API สำหรับ AI แบบ OpenAI-compatible, ระบบรับ Lead และไฟล์แนบแบบ JSON, หน้าผู้ดูแล และคลังความรู้สำหรับ RAG ระยะเริ่มต้น

## เริ่มใช้งานในเครื่อง

ต้องใช้ Node.js 20.6 ขึ้นไป (ไม่ต้องติดตั้ง package เพิ่ม)

```bash
cp .env.example .env
```

แก้ค่าใน `.env` ให้มีรหัสผ่านผู้ดูแลและ secret ที่สุ่มใหม่ ห้ามใช้ค่าตัวอย่างใน production

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

ใส่ผลลัพธ์ที่ได้ใน `APP_SECRET` และตั้ง `ADMIN_PASSWORD` เป็นรหัสผ่านที่ยาว/ไม่ซ้ำ จากนั้นเริ่มเซิร์ฟเวอร์:

```bash
npm start
```

เปิดเว็บที่ <http://localhost:3000/ai/> และหลังบ้านที่ <http://localhost:3000/ai/admin/> หากไม่ได้ตั้งค่า AI key การประเมินแบบมีตัวเลือกและเครื่องคำนวณยังทำงานได้ แต่การสนทนาอิสระและการอ่านข้อความ/ถอดเสียงจากไฟล์จะไม่ทำงาน

## เชื่อมต่อ AI Model

ตั้งค่าจากหน้า `/ai/admin/` ได้หลังเข้าสู่ระบบ หรือกำหนดผ่าน Environment:

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_API_KEY=...
```

จากเมนู **AI Providers** ในหลังบ้าน เพิ่มและสลับผู้ให้บริการได้หลายรายการ: OpenAI, OpenRouter หรือ OpenAI-compatible/Custom พร้อมทดสอบการเชื่อมต่อก่อนใช้งาน แต่ละ Provider กำหนดชื่อ, Base URL, Model ID และ API key แยกกัน ระบบเรียก endpoint **Chat Completions**; การอ่านภาพต้องรองรับ `image_url` และการถอดเสียงต้องรองรับ `/audio/transcriptions` ตามฟีเจอร์ที่เปิดใช้

API key ที่บันทึกผ่าน Admin จะถูกเข้ารหัสด้วย AES-256-GCM ก่อนเขียน `data/settings.json`; ต้องตั้ง `APP_SECRET` อย่างน้อย 24 ตัวอักษรเพื่อบันทึก key และคงค่าเดิมไว้เพื่อถอดรหัสหลังรีสตาร์ต (Production บังคับอย่างน้อย 32 ตัวอักษร) ค่า `AI_API_KEY`, `AI_BASE_URL` และ `AI_MODEL` จาก Environment มีลำดับความสำคัญสูงกว่าค่า Provider; API key จาก Environment แก้ไขจากหน้าเว็บไม่ได้

เมนู **จัดการ Skills** แก้ไข เพิ่ม ลบ และเปิด/ปิดชุดคำแนะนำได้ ค่าเริ่มต้นมี Solar Advisor, Bill Reading และ Financial & Policy Safety เฉพาะ Skills ที่เปิดใช้งานจะถูกรวมกับคำสั่งระบบของแชต การประเมิน และการวิเคราะห์ไฟล์แนบ

อย่าใส่ API key ใน `index.html`, `app.js`, GitHub Actions logs หรือ frontend configuration

## ฟีเจอร์และขอบเขตปัจจุบัน

- เว็บประเมินพร้อมรายงาน On-grid/Hybrid และตัวอย่างข้อมูล ใช้งานบน subpath `/ai/` ด้วยไฟล์ static ที่อ้างอิงแบบ relative
- มีการยินยอม/ปฏิเสธก่อนเก็บข้อมูล ลูกค้าพิมพ์คำตอบแทนการกดตัวเลือกได้ในขั้นตอนที่รองรับ
- เมื่อเปิดใช้ Model ระบบสร้างคำถามต่อเนื่องภาษาไทยได้; หลังประเมินถามคำถามเพิ่มเติมได้
- ไฟล์ภาพ JPEG/PNG/WebP วิเคราะห์บิลด้วย vision ได้เมื่อ Model รองรับ; ไฟล์เสียงส่งไปถอดเสียงเมื่อ provider รองรับ; ไฟล์ข้อความสรุปได้; PDF เก็บไว้ให้ผู้ดูแลดาวน์โหลด แต่ **ยังไม่มี OCR/การอ่าน PDF อัตโนมัติ**
- Lead, ประวัติข้อความ และ metadata ไฟล์แนบเก็บเป็น JSON ใน `DATA_DIR` (ค่าเริ่มต้น `./data`); ไฟล์แนบอยู่ในโฟลเดอร์ private `data/uploads/` และดาวน์โหลดได้เฉพาะผู้ดูแล
- หลังบ้านใช้รหัสผ่าน `ADMIN_PASSWORD`, session cookie แบบ HttpOnly/SameSite=Strict และจัดการ AI Providers/Models, System Prompt, Skills, Lead, ไฟล์แนบ และ Knowledge Base
- RAG ปัจจุบันเป็น keyword ranking จาก `knowledge/knowledge-base.json` ไม่ใช่ vector database/embeddings; เนื้อหาที่ `needs-review` ต้องตรวจสอบก่อนนำไปตอบลูกค้าจริง

## Deploy ที่ `/ai/`

รัน Node server โดยตั้ง `BASE_PATH=/ai`, เปิด TLS ที่ reverse proxy และส่ง path `/ai/*` มายัง Node server โดยคง path เดิมไว้ ตัวอย่าง environment ขั้นต่ำ:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
BASE_PATH=/ai
DATA_DIR=/var/lib/zynernova-ultra-ai
TRUST_PROXY=true # เปิดเฉพาะหลัง reverse proxy ที่เชื่อถือได้และตั้ง X-Forwarded-* ถูกต้อง
ADMIN_PASSWORD=<unique-long-password>
APP_SECRET=<random-secret-at-least-32-characters>
```

ใน Production ต้องใช้ HTTPS ทั้งเว็บไซต์และ AI Base URL, จำกัดผู้เข้าถึงหลังบ้านที่ proxy/firewall เพิ่มเติมเมื่อทำได้, เก็บ `DATA_DIR` ใน persistent private volume, ตั้ง backup/retention, และไม่เปิด static hosting อย่างเดียว เพราะ GitHub Pages ไม่สามารถรัน API หรือเก็บ Lead ให้ได้

## Data, privacy และความถูกต้องของตัวเลข

- ไฟล์ใน `data/` มีข้อมูลส่วนบุคคลและ API key ที่เข้ารหัส: อย่า commit, แชร์ หรือเก็บไว้ใน public web root; มี `.gitignore` ป้องกันไว้
- ผู้ให้บริการ AI ที่ตั้งค่าอาจได้รับข้อความหรือไฟล์ที่จำเป็นต่อคำขอ ผู้ดูแลต้องตรวจนโยบายการเก็บ/ประมวลผลข้อมูลของ provider และแจ้งผู้ใช้ให้ครบถ้วนก่อนเปิดจริง
- ควรกำหนดช่องทางรับคำขอใช้สิทธิ/ถอนความยินยอม ระยะเวลาเก็บข้อมูล และกระบวนการลบไฟล์ก่อนรับข้อมูลลูกค้าจริง
- ราคา อัตราประหยัด เงินสนับสนุน สิทธิลดหย่อนภาษี และตัวเลขสินเชื่อจาก handoff เป็นสมมติฐานในเครื่องคำนวณ ไม่ได้ยืนยันจากแหล่งทางการในโครงการนี้ ต้องให้ทีมธุรกิจ/กฎหมายตรวจสอบและปรับก่อนเผยแพร่

## ตรวจสอบ

```bash
npm test
node --check server.js
node --check app.js
node --check admin.js
```

อ่านคู่มือเพิ่มที่ [README-INTEGRATION.md](README-INTEGRATION.md) และบริบท/roadmap ที่ [PROJECT-HANDOFF-PROMPT.md](PROJECT-HANDOFF-PROMPT.md).
