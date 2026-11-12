(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const API_BASE = new URL('api/', document.baseURI).href;

  let attachmentBusy = false;

  const els = {
    messages: $('#messages'),
    typing: $('#typing'),
    form: $('#responseForm'),
    input: $('#answerInput'),
    send: $('#sendBtn'),
    quick: $('#quickReplies'),
    upload: $('#uploadBtn'),
    file: $('#fileInput'),
    hint: $('#composerHint'),
    estimate: $('#estimateContent'),
    progressText: $('#progressText'),
    progressBar: $('#progressBar'),
    stages: $$('#journeySteps li'),
    openReportTop: $('#openReportTop'),
    report: $('#reportModal'),
    reportBody: $('#reportBody'),
    reportId: $('#reportId'),
    toast: $('#toast')
  };

  const steps = [
    {
      key: 'consent', type: 'options',
      options: [
        { label: 'ยินยอม เริ่มประเมิน', value: true },
        { label: 'ไม่ยินยอม', value: false },
        { label: 'ดูวิธีใช้ข้อมูล', action: 'privacy' }
      ]
    },
    {
      key: 'bill', type: 'number', placeholder: 'เช่น 4,000', upload: true,
      hint: 'พิมพ์ค่าไฟเฉลี่ยต่อเดือน หรือแนบรูปบิลเพื่อให้ AI อ่าน',
      options: [
        { label: '2,000 บาท', value: 2000 },
        { label: '4,000 บาท', value: 4000 },
        { label: '8,000 บาท', value: 8000 }
      ]
    },
    {
      key: 'usage', type: 'options',
      options: [
        { label: 'กลางวันเป็นหลัก', value: 'day' },
        { label: 'กลางวัน–กลางคืนพอ ๆ กัน', value: 'mixed' },
        { label: 'กลางคืนเป็นหลัก', value: 'night' }
      ]
    },
    {
      key: 'location', type: 'text', placeholder: 'เช่น บางนา, กรุงเทพมหานคร',
      hint: 'ใช้ประเมินแดดและเตรียมตรวจหลังคาจากตำแหน่งโดยประมาณ'
    },
    {
      key: 'roofArea', type: 'options',
      options: [
        { label: 'ไม่แน่ใจ ให้ทีมประเมิน', value: null },
        { label: '20–30 ตร.ม.', value: 25 },
        { label: '31–50 ตร.ม.', value: 40 },
        { label: 'มากกว่า 50 ตร.ม.', value: 60 }
      ]
    },
    {
      key: 'tax', type: 'options',
      options: [
        { label: 'ไม่เสียภาษี / ไม่แน่ใจ', value: 0 },
        { label: 'ฐานภาษี 10%', value: 10 },
        { label: 'ฐานภาษี 20%', value: 20 },
        { label: 'ฐานภาษี 30%', value: 30 }
      ]
    },
    {
      key: 'payment', type: 'options',
      options: [
        { label: 'จ่ายสด', value: 'cash' },
        { label: 'อยากผ่อนรายเดือน', value: 'loan' },
        { label: 'ขอเทียบทั้งสองแบบ', value: 'both' }
      ]
    },
    {
      key: 'timeline', type: 'options',
      options: [
        { label: 'ภายใน 30 วัน', value: '30d' },
        { label: 'ภายใน 1–3 เดือน', value: '3m' },
        { label: 'กำลังศึกษาข้อมูล', value: 'explore' }
      ]
    },
    {
      key: 'name', type: 'text', placeholder: 'ชื่อที่ให้เราเรียก',
      hint: 'ใช้สำหรับระบุชื่อในรายงานและการติดต่อกลับ'
    },
    {
      key: 'phone', type: 'tel', placeholder: '0XX-XXX-XXXX',
      hint: 'ทีมผู้เชี่ยวชาญจะใช้เบอร์นี้ติดต่อกลับตามเวลาที่เหมาะสม'
    }
  ];

  const sampleData = {
    consent: true,
    bill: 4000,
    billLabel: '4,000 บาท',
    usage: 'mixed',
    usageLabel: 'กลางวัน–กลางคืนพอ ๆ กัน',
    location: 'บางนา, กรุงเทพมหานคร',
    locationLabel: 'บางนา, กรุงเทพมหานคร',
    roofArea: 40,
    roofAreaLabel: '31–50 ตร.ม.',
    tax: 20,
    taxLabel: 'ฐานภาษี 20%',
    payment: 'both',
    paymentLabel: 'ขอเทียบทั้งสองแบบ',
    timeline: '3m',
    timelineLabel: 'ภายใน 1–3 เดือน',
    name: 'คุณณัฐ',
    nameLabel: 'คุณณัฐ',
    phone: '0891234567',
    phoneLabel: '089-123-4567'
  };

  let state = { current: 0, data: {}, demo: false, leadId: '', leadSaved: false, declined: false, conversation: [] };
  let toastTimer;
  let busy = false;

  const fmt = (value) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(value || 0));
  const safe = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function icon(id, cls = '') {
    return `<svg class="${cls}" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  function init() {
    state = { current: 0, data: {}, demo: false, leadId: '', leadSaved: false, declined: false, conversation: [] };
    busy = false;
    attachmentBusy = false;
    els.messages.innerHTML = '';
    els.typing.classList.remove('show');
    addMessage('assistant', `
      <strong>สวัสดีครับ ผมชื่อ “น้อง Ultra” ⚡️ วิศวกรผู้ช่วยวางแผนโซลาร์ของคุณ</strong><br>
      ผมจะถามประมาณ 8–10 ข้อ แล้วคำนวณขนาดระบบ เงินที่ประหยัด และทางเลือกชำระเงินที่เหมาะกับบ้านคุณ
      <div class="inline-stat"><span>ใช้เวลาประมาณ 2 นาที</span><span>ไม่มีค่าใช้จ่าย</span></div>
    `, true);
    addMessage('assistant', 'ก่อนเริ่ม คุณยินยอมให้ใช้คำตอบและไฟล์แนบเพื่อจัดทำรายงาน บันทึกเป็นข้อมูลผู้สนใจ และให้ทีมผู้เชี่ยวชาญติดต่อกลับไหมครับ? หากเปิดใช้ AI ข้อมูลที่จำเป็นอาจถูกส่งไปยังผู้ให้บริการโมเดลที่ผู้ดูแลตั้งค่าเพื่อช่วยตอบหรืออ่านไฟล์', true);
    updateProgress();
    renderEstimate();
    configureComposer();
  }

  function addMessage(role, content, isHtml = false, isFile = false) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    const time = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    const bubbleContent = isHtml ? content : safe(content);

    if (role === 'assistant') {
      row.innerHTML = `
        <div class="mini-avatar"><img src="assets/ultra-avatar.png" alt="น้อง Ultra" /></div>
        <div class="message-stack">
          <div class="message-meta">น้อง Ultra ⚡️ AI · ${time}</div>
          <div class="message-bubble">${bubbleContent}</div>
        </div>`;
    } else {
      row.innerHTML = `
        <div class="message-stack">
          <div class="message-meta">คุณ · ${time}</div>
          <div class="message-bubble ${isFile ? 'file-bubble' : ''}">${isFile ? icon('i-upload') : ''}${bubbleContent}</div>
        </div>`;
    }
    els.messages.appendChild(row);
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
  }

  function configureComposer() {
    const step = steps[state.current];
    $('#resetBtn').disabled = busy || attachmentBusy;
    $('#demoBtn').disabled = busy || attachmentBusy;
    els.quick.innerHTML = '';
    els.input.value = '';
    els.upload.hidden = state.declined || state.demo || !state.data.consent || state.current === 0;
    els.upload.disabled = busy || attachmentBusy;

    if (state.declined) {
      els.input.disabled = true;
      els.input.placeholder = 'การประเมินยังไม่เริ่ม';
      els.send.disabled = true;
      els.hint.innerHTML = `${icon('i-lock')} เคารพการตัดสินใจของคุณ ไม่มีการบันทึกคำตอบ`;
      return;
    }

    if (!step && state.current >= steps.length && state.data.consent) {
      els.input.type = 'text';
      els.input.inputMode = 'text';
      els.input.disabled = busy || attachmentBusy;
      els.input.placeholder = 'ถามน้อง Ultra เพิ่มเติม…';
      els.send.disabled = busy || attachmentBusy || !els.input.value.trim();
      els.hint.innerHTML = `${icon('i-lock')} ${state.leadSaved ? 'คุณส่งข้อมูลประเมินแล้ว' : 'รายงานนี้ยังไม่ได้บันทึกบนระบบหลังบ้าน'} · คำตอบ AI อาจใช้ข้อมูลการประเมิน`;
      return;
    }

    if (!step) {
      els.input.disabled = true;
      els.input.placeholder = busy || attachmentBusy ? 'กำลังประมวลผล…' : 'ประเมินเสร็จเรียบร้อย';
      els.send.disabled = true;
      els.hint.innerHTML = `${icon('i-lock')} ข้อมูลถูกใช้ตามความยินยอมของคุณ`;
      return;
    }

    els.input.type = step.type === 'number' ? 'text' : (step.type === 'tel' ? 'tel' : 'text');
    els.input.inputMode = step.type === 'number' ? 'numeric' : (step.type === 'tel' ? 'tel' : 'text');
    els.input.disabled = busy || attachmentBusy || step.key === 'consent';
    els.input.placeholder = step.type === 'options' ? 'เลือกปุ่ม หรือพิมพ์คำตอบ' : step.placeholder;
    els.upload.hidden = state.demo || !state.data.consent;
    els.upload.disabled = busy || attachmentBusy;
    els.send.disabled = busy || attachmentBusy || step.key === 'consent' || !els.input.value.trim();
    els.hint.innerHTML = `${icon('i-lock')} ${safe(step.hint || 'เลือกคำตอบที่ใกล้เคียงที่สุด หรือพิมพ์คำตอบเอง')}`;

    (step.options || []).forEach(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-chip';
      button.textContent = option.label;
      button.disabled = busy || attachmentBusy;
      button.addEventListener('click', () => {
        if (busy || attachmentBusy) return;
        if (option.action === 'privacy') {
          openDialog($('#privacyModal'));
          return;
        }
        submitAnswer(option.label, option.value);
      });
      els.quick.appendChild(button);
    });
  }

  function validateAndSubmit() {
    if (busy || attachmentBusy || state.declined) return;
    const step = steps[state.current];
    if (!step) {
      if (state.current >= steps.length && state.data.consent) sendFollowup();
      return;
    }
    if (step.key === 'consent') return;

    const raw = els.input.value.trim();
    if (!raw) return showToast('กรุณาพิมพ์คำตอบก่อนส่ง', 'i-info');

    if (step.type === 'options') {
      const resolved = resolveOption(step, raw);
      if (!resolved) return showToast('ยังจับคู่คำตอบไม่ได้ กรุณาเลือกปุ่มที่ใกล้เคียงที่สุด', 'i-info');
      submitAnswer(resolved.label, resolved.value);
      return;
    }

    if (step.key === 'bill') {
      const value = Number(raw.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(value) || value < 500 || value > 100000) {
        return showToast('กรุณาระบุค่าไฟระหว่าง 500–100,000 บาท', 'i-info');
      }
      submitAnswer(`${fmt(value)} บาท`, value);
      return;
    }

    if (step.key === 'phone') {
      const digits = raw.replace(/\D/g, '');
      if (!/^0\d{8,9}$/.test(digits)) {
        return showToast('กรุณาตรวจสอบเบอร์โทรศัพท์อีกครั้ง', 'i-info');
      }
      submitAnswer(formatPhone(digits), digits);
      return;
    }

    if (raw.length < 2) return showToast('กรุณาระบุข้อมูลให้ครบถ้วน', 'i-info');
    submitAnswer(raw.slice(0, step.key === 'location' ? 160 : 120), raw.slice(0, step.key === 'location' ? 160 : 120));
  }

  function resolveOption(step, raw) {
    const text = raw.trim().toLocaleLowerCase('th-TH');
    const exact = (step.options || []).find(option => String(option.label).toLocaleLowerCase('th-TH') === text);
    if (exact) return exact;

    let value;
    if (step.key === 'usage') {
      if (/กลางวัน/.test(text) && /กลางคืน/.test(text)) value = 'mixed';
      else if (/กลางวัน|ตอนเช้า|ตอนบ่าย|day/.test(text)) value = 'day';
      else if (/กลางคืน|กลางคืนเป็นหลัก|night/.test(text)) value = 'night';
      else if (/ผสม|พอ.?ๆ|เท่า.?กัน|ทั้งวัน/.test(text)) value = 'mixed';
    } else if (step.key === 'roofArea') {
      if (/ไม่แน่|ไม่ทราบ|ให้ทีม|ไม่รู้/.test(text)) value = null;
      else if (/มากกว่า\s*50|เกิน\s*50|>\s*50/.test(text)) value = 60;
      else {
        const number = Number(text.match(/\d+(?:\.\d+)?/)?.[0]);
        if (Number.isFinite(number) && number > 0) value = number <= 30 ? 25 : (number <= 50 ? 40 : 60);
      }
    } else if (step.key === 'tax') {
      if (/ไม่เสีย|ไม่แน่|ไม่มี/.test(text)) value = 0;
      else {
        const match = text.match(/\d{1,2}/);
        if (match) {
          const number = Number(match[0]);
          value = [0, 10, 20, 30].reduce((closest, current) => Math.abs(current - number) < Math.abs(closest - number) ? current : closest, 0);
        }
      }
    } else if (step.key === 'payment') {
      if (/ผ่อน|กู้|สินเชื่อ|loan/.test(text)) value = 'loan';
      else if (/สด|เงินสด|cash/.test(text)) value = 'cash';
      else if (/ทั้งสอง|เทียบ|เปรียบเทียบ|both/.test(text)) value = 'both';
    } else if (step.key === 'timeline') {
      if (/30\s*วัน|ภายใน\s*30|เดือนนี้|เร็วที่สุด/.test(text)) value = '30d';
      else if (/1\s*[-–ถึง]\s*3|1-3|3\s*เดือน|สามเดือน/.test(text)) value = '3m';
      else if (/ศึกษา|ดูก่อน|ยังไม่|สำรวจ|explore/.test(text)) value = 'explore';
    }

    return (step.options || []).find(option => option.value === value) || null;
  }

  function submitAnswer(label, value, isFile = false) {
    const step = steps[state.current];
    if (!step || busy || attachmentBusy) return;

    if (step.key === 'consent' && value !== true) {
      state.data.consent = false;
      state.declined = true;
      addMessage('user', label, false, isFile);
      addMessage('assistant', 'รับทราบครับ ผมจะไม่ถามหรือบันทึกข้อมูลการประเมิน หากเปลี่ยนใจสามารถกด “เริ่มใหม่” ได้ทุกเมื่อ', true);
      updateProgress();
      renderEstimate();
      configureComposer();
      return;
    }

    busy = true;
    state.data.attachments ||= [];
    addMessage('user', label, false, isFile);
    state.data[step.key] = value;
    state.data[`${step.key}Label`] = label;
    if (step.key === 'consent') state.data.consent = true;
    addConversation('user', label, step.key);
    state.current += 1;

    updateProgress();
    renderEstimate();
    configureComposer();
    showTyping(true);

    const delay = step.key === 'phone' ? 850 : (step.key === 'bill' ? 720 : 480);
    window.setTimeout(async () => {
      if (state.current >= steps.length) {
        showTyping(false);
        await finishAssessment();
        return;
      }

      let nextPrompt = promptForStep(state.current);
      let aiGenerated = false;
      const nextStep = steps[state.current];
      const canUseAi = state.data.consent && ['bill', 'usage', 'roofArea', 'tax', 'payment'].includes(step.key);
      if (canUseAi && nextStep && !['name', 'phone', 'location'].includes(nextStep.key)) {
        const reply = await askAssistant({
          step: step.key,
          nextStep: nextStep.key,
          answer: label,
          context: qualificationContext()
        });
        if (reply) {
          nextPrompt = reply;
          aiGenerated = true;
        }
      }

      showTyping(false);
      addMessage('assistant', nextPrompt, !aiGenerated);
      addConversation('assistant', nextPrompt, nextStep?.key || '');
      busy = false;
      configureComposer();
      if (!els.input.disabled) window.setTimeout(() => els.input.focus(), 50);
    }, delay);
  }

  function stripMarkup(value) {
    const holder = document.createElement('div');
    holder.innerHTML = String(value || '');
    return holder.textContent.replace(/\s+/g, ' ').trim();
  }

  function addConversation(role, content, stepKey = '') {
    if (!state.conversation || ['name', 'phone'].includes(stepKey) || state.demo) return;
    const text = role === 'assistant' && String(content).includes('<') ? stripMarkup(content) : String(content || '');
    if (!text.trim()) return;
    state.conversation.push({ role, step: stepKey, content: text.slice(0, 900), createdAt: new Date().toISOString() });
    state.conversation = state.conversation.slice(-30);
  }

  function qualificationContext() {
    const data = state.data;
    return {
      bill: data.bill || null,
      usage: data.usage || null,
      usageLabel: data.usageLabel || '',
      roofArea: data.roofArea ?? null,
      roofAreaLabel: data.roofAreaLabel || '',
      tax: data.tax ?? null,
      taxLabel: data.taxLabel || '',
      payment: data.payment || '',
      paymentLabel: data.paymentLabel || '',
      timeline: data.timeline || '',
      timelineLabel: data.timelineLabel || ''
    };
  }

  async function askAssistant(payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(new URL('assistant', API_BASE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, ...payload }),
        signal: controller.signal
      });
      if (!response.ok) return '';
      const result = await response.json();
      return result.configured && typeof result.reply === 'string' ? result.reply.trim() : '';
    } catch (_) {
      return '';
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function sendFollowup() {
    if (busy || attachmentBusy || !state.data.consent) return;
    const message = els.input.value.trim();
    if (!message) return;
    const history = state.conversation.slice(-10);
    busy = true;
    addMessage('user', message);
    state.conversation.push({ role: 'user', step: 'followup', content: message.slice(0, 900), createdAt: new Date().toISOString() });
    state.conversation = state.conversation.slice(-30);
    configureComposer();
    showTyping(true);

    try {
      const response = await fetch(new URL('chat', API_BASE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          message,
          context: qualificationContext(),
          conversation: history,
          leadId: state.leadSaved ? state.leadId : ''
        })
      });
      const result = response.ok ? await response.json() : null;
      showTyping(false);
      if (result?.configured && result.reply) {
        addMessage('assistant', result.reply);
        state.conversation.push({ role: 'assistant', step: 'followup', content: result.reply.slice(0, 900), createdAt: new Date().toISOString() });
        state.conversation = state.conversation.slice(-30);
      } else {
        addMessage('assistant', 'ระบบตอบคำถามอิสระยังไม่ได้เชื่อมต่อ AI กรุณาติดต่อทีมที่ปรึกษาหรือดูข้อมูลในรายงานได้เลยครับ');
      }
    } catch (_) {
      showTyping(false);
      addMessage('assistant', 'ขณะนี้เชื่อมต่อระบบ AI ไม่ได้ ข้อมูลในรายงานที่จัดทำไว้ยังดูได้ตามปกติครับ');
    }
    busy = false;
    configureComposer();
  }

  function promptForStep(index) {
    const data = state.data;
    const calc = calculate(data);
    switch (index) {
      case 1:
        return `<strong>ขอบคุณที่ไว้วางใจครับ</strong><br>เริ่มจากบิลค่าไฟ คุณพิมพ์ค่าเฉลี่ยต่อเดือน หรือกดปุ่มแนบรูปบิลให้ AI อ่านก็ได้ครับ`;
      case 2:
        return `จากค่าไฟ <strong>${fmt(data.bill)} บาท/เดือน</strong> บ้านคุณใช้ไฟราว ${fmt(calc.units)} หน่วย/เดือน เบื้องต้นระบบ ${calc.size} kW น่าจะพอดีครับ<br><br>ปกติใช้ไฟช่วงไหนมากที่สุดครับ?`;
      case 3:
        return data.usage === 'day'
          ? `ดีมากครับ การใช้ไฟกลางวันช่วยให้ใช้ไฟจากแผงได้โดยตรงและคืนทุนไวขึ้น บ้านอยู่เขต/อำเภอและจังหวัดใดครับ?`
          : `รับทราบครับ ผมจะนำสัดส่วนการใช้ไฟไปเทียบ On-grid กับ Hybrid ให้ บ้านอยู่เขต/อำเภอและจังหวัดใดครับ?`;
      case 4:
        return `รับตำแหน่ง <strong>${safe(data.location)}</strong> แล้วครับ พื้นที่หลังคาที่พอใช้ติดตั้งได้ประมาณเท่าไรครับ? ถ้าไม่แน่ใจเลือกให้ทีมประเมินภายหลังได้เลย`;
      case 5:
        return `ระบบ ${calc.size} kW ต้องใช้พื้นที่ประมาณ <strong>${fmt(calc.area)} ตร.ม.</strong> ขั้นต่อไปผมจะเทียบสิทธิประโยชน์ให้ ฐานภาษีเงินได้สูงสุดของคุณอยู่ช่วงไหนครับ?`;
      case 6:
        return `เข้าใจแล้วครับ ${data.tax > 0 ? `หากเข้าเงื่อนไข สิทธิลดหย่อนอาจช่วยลดภาษีได้ประมาณ <strong>${fmt(calc.taxRefund)} บาท</strong>` : 'ผมจะเน้นเปรียบเทียบเงินสนับสนุนและราคาสุทธิให้'} ต้องการดูรูปแบบชำระแบบไหนเป็นหลักครับ?`;
      case 7:
        return `ผมจะจัดทั้งราคาสุทธิ ค่างวด และเงินเหลือหลังหักค่าไฟให้เทียบกันครับ คุณคิดว่าจะติดตั้งช่วงไหน?`;
      case 8:
        return `เหลืออีกเพียง 2 ข้อครับ ✨ ขอชื่อที่ให้เราใช้เรียกและใส่ในรายงานได้ไหมครับ?`;
      case 9:
        return `ยินดีที่ได้รู้จักครับ <strong>${safe(data.name)}</strong> กรุณาระบุเบอร์โทรเพื่อรับรายงาน และให้ผู้เชี่ยวชาญนัดตรวจหลังคาโดยไม่มีค่าใช้จ่ายครับ`;
      default:
        return '';
    }
  }

  function showTyping(show) {
    els.typing.classList.toggle('show', show);
    els.typing.setAttribute('aria-hidden', String(!show));
    if (show) requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
  }

  function updateProgress() {
    const progress = Math.min(100, Math.round((state.current / steps.length) * 100));
    els.progressText.textContent = `${progress}%`;
    els.progressBar.style.width = `${progress}%`;

    let activeStage = 0;
    if (state.current >= 3) activeStage = 1;
    if (state.current >= 5) activeStage = 2;
    if (state.current >= 7) activeStage = 3;
    if (state.current >= 10) activeStage = 4;

    els.stages.forEach((stage, index) => {
      stage.classList.toggle('active', index === activeStage);
      stage.classList.toggle('done', index < activeStage || state.current >= steps.length);
    });
  }

  function calculate(data) {
    const bill = Number(data.bill || 0);
    const units = bill ? Math.round(bill / 4.4) : 0;
    const size = bill <= 2500 ? 3 : (bill <= 6500 ? 5 : 10);
    const production = size * 120;
    const panels = Math.ceil((size * 1000) / 585);
    const area = Math.ceil(panels * 2.85);
    const selfRates = { day: .76, mixed: .607, night: .35 };
    const hybridRates = { day: .91, mixed: .832, night: .75 };
    const selfRate = selfRates[data.usage] ?? .607;
    const hybridRate = hybridRates[data.usage] ?? .832;
    const selfUnits = Math.round(production * selfRate);
    const exportUnits = production - selfUnits;
    const hybridSelf = Math.round(production * hybridRate);
    const hybridExport = production - hybridSelf;
    const savings = Math.round((selfUnits * 4.498) + (exportUnits * 2.2));
    const hybridSavings = Math.round((hybridSelf * 4.498) + (hybridExport * 2.2));
    const prices = { 3: 99000, 5: 139000, 10: 239000 };
    const hybridPrices = { 3: 159000, 5: 214000, 10: 359000 };
    const price = prices[size];
    const hybridPrice = hybridPrices[size];
    const taxRefund = Math.round(Math.min(price, 200000) * ((Number(data.tax) || 0) / 100));
    const subsidy = size >= 5 ? 50000 : 0;
    const taxNet = price - taxRefund;
    const subsidyNet = price - subsidy;
    const bestNet = subsidy && subsidy > taxRefund ? subsidyNet : taxNet;
    const bestBenefit = subsidy && subsidy > taxRefund ? 'เงินสนับสนุน 50,000 บาท' : (taxRefund > 0 ? 'สิทธิลดหย่อนภาษี' : 'ราคาจ่ายสด');
    const payback = savings ? price / (savings * 12) : 0;
    const bestPayback = savings ? bestNet / (savings * 12) : 0;
    const hybridPayback = hybridSavings ? hybridPrice / (hybridSavings * 12) : 0;
    const loanPrincipal = subsidy ? subsidyNet : price;
    const monthlyRate = .025 / 12;
    const months = 84;
    const monthlyLoan = Math.round(loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
    const netMonthly = savings - monthlyLoan;
    const savingFactor25 = (1 - Math.pow(.995, 25)) / (1 - .995);
    const profit25 = Math.round((savings * 12 * savingFactor25) - bestNet);
    const roofFits = !data.roofArea || data.roofArea >= area;
    const extraBatteryPayback = (hybridSavings - savings) > 0 ? (hybridPrice - price) / ((hybridSavings - savings) * 12) : 0;
    return {
      bill, units, size, production, panels, area, selfUnits, exportUnits, hybridSelf, hybridExport,
      savings, hybridSavings, price, hybridPrice, taxRefund, subsidy, taxNet, subsidyNet, bestNet,
      bestBenefit, payback, bestPayback, hybridPayback, monthlyLoan, netMonthly, profit25, roofFits,
      extraBatteryPayback
    };
  }

  function confidenceScore() {
    if (!state.data.bill) return 0;
    let score = 30;
    if (state.data.usage) score += 25;
    if (state.data.location) score += 13;
    if ('roofArea' in state.data) score += 10;
    if ('tax' in state.data) score += 7;
    if (state.data.payment) score += 5;
    if (state.data.timeline) score += 4;
    if (state.data.phone) score += 6;
    return Math.min(score, 100);
  }

  function renderEstimate() {
    if (!state.data.bill) {
      els.estimate.innerHTML = `
        <div class="estimate-empty">
          <div class="empty-visual">
            <div class="sun-orbit"><span class="orbit-dot"></span><div class="sun-core">${icon('i-sun')}</div></div>
            <div class="visual-label">AI + ENERGY MODEL</div>
          </div>
          <div class="empty-copy">
            <h2>ผลลัพธ์จะชัดขึ้น<br>ทุกครั้งที่คุณตอบ</h2>
            <p>AI จะเปลี่ยนคำตอบของคุณเป็นขนาดระบบที่เหมาะสม พร้อมเทียบ On-grid, Hybrid และสิทธิประโยชน์</p>
            <ul class="empty-list">
              <li>${icon('i-bolt')} เงินที่ประหยัด</li>
              <li>${icon('i-chart')} ระยะคืนทุน</li>
              <li>${icon('i-home')} จำนวนแผง</li>
              <li>${icon('i-percent')} สิทธิที่ใช้ได้</li>
            </ul>
          </div>
        </div>`;
      els.openReportTop.disabled = true;
      return;
    }

    const c = calculate(state.data);
    const confidence = confidenceScore();
    const final = state.current >= steps.length;
    const hasUsage = Boolean(state.data.usage);
    const usageInsight = !hasUsage
      ? 'ตอบเรื่องช่วงเวลาที่ใช้ไฟอีก 1 ข้อ เพื่อคำนวณเงินประหยัดได้แม่นขึ้น'
      : state.data.usage === 'night'
        ? 'บ้านใช้ไฟกลางคืนมาก ระบบ Hybrid จะใช้ไฟที่ผลิตได้คุ้มขึ้น แต่ต้องเทียบต้นทุนแบตเตอรี่'
        : state.data.usage === 'day'
          ? 'รูปแบบใช้ไฟกลางวันเหมาะกับ On-grid และมีแนวโน้มคืนทุนได้เร็ว'
          : 'On-grid คุ้มด้านคืนทุน ส่วน Hybrid เหมาะเมื่อให้ความสำคัญกับไฟสำรอง';

    els.estimate.innerHTML = `
      <div class="estimate-card">
        <div class="estimate-kicker">${icon('i-spark')} AI RECOMMENDATION</div>
        <div class="estimate-main">
          <div class="system-size"><span>ขนาดระบบเบื้องต้น</span><strong>${c.size}<small>kW</small></strong></div>
          <div class="month-save"><span>คาดว่าประหยัด</span><b>${hasUsage ? `${fmt(c.savings)} ฿` : '—'}</b><small>ต่อเดือน</small></div>
        </div>
        <div class="confidence"><span class="confidence-bar"><i style="width:${confidence}%"></i></span> ความแม่นยำข้อมูล <span>${confidence}%</span></div>
      </div>
      <div class="quick-metrics">
        <div class="quick-metric"><span>ใช้ไฟประมาณ</span><b>${fmt(c.units)} <small>หน่วย</small></b></div>
        <div class="quick-metric"><span>จำนวนแผง</span><b>${fmt(c.panels)} <small>แผง</small></b></div>
        <div class="quick-metric"><span>พื้นที่หลังคา</span><b>${fmt(c.area)} <small>ตร.ม.</small></b></div>
      </div>
      <div class="insight-card">
        <div class="insight-head">${icon('i-spark')} AI Insight</div>
        <p>${usageInsight}${state.data.roofArea && !c.roofFits ? ' พื้นที่ที่แจ้งอาจไม่พอ ควรให้ทีมออกแบบระบบขนาดเล็กลงหรือใช้แผงประสิทธิภาพสูง' : ''}</p>
      </div>
      ${hasUsage ? `
        <div class="compare-mini">
          <div class="compare-title"><b>เงินประหยัดต่อเดือน</b><span>ประมาณการ</span></div>
          <div class="bar-row"><span>On-grid</span><span class="bar-track"><i style="width:${Math.max(12, (c.savings / c.hybridSavings) * 100)}%"></i></span><strong>${fmt(c.savings)} ฿</strong></div>
          <div class="bar-row hybrid"><span>Hybrid</span><span class="bar-track"><i style="width:100%"></i></span><strong>${fmt(c.hybridSavings)} ฿</strong></div>
        </div>` : ''}
      ${final ? `
        <div class="lead-saved">
          <span class="lead-check">${icon(state.demo || state.leadSaved ? 'i-check' : 'i-info')}</span>
          <div><b>${state.demo ? 'ข้อมูลตัวอย่างพร้อมดูรายงาน' : state.leadSaved ? `บันทึก Lead สำเร็จ · ${safe(state.leadId)}` : 'ยังไม่ได้บันทึก Lead ไปยังระบบหลังบ้าน'}</b><small>${state.demo ? 'ข้อมูลชุดนี้จะไม่ถูกบันทึก' : state.leadSaved ? 'พร้อมส่งต่อทีมที่ปรึกษาเพื่อดูแลต่อ' : 'รายงานยังดูได้ในเซสชันนี้ แต่ทีมจะไม่ได้รับข้อมูลโดยอัตโนมัติ'}</small></div>
        </div>
        <div class="result-actions">
          <button class="open-report" id="openReportBtn">เปิดรายงานฉบับเต็ม</button>
          <button class="copy-summary" id="copySummaryBtn" title="คัดลอกสรุป">${icon('i-copy')}</button>
        </div>` : ''}`;

    els.openReportTop.disabled = !final;
    $('#openReportBtn')?.addEventListener('click', openReport);
    $('#copySummaryBtn')?.addEventListener('click', copySummary);
  }

  async function finishAssessment() {
    busy = true;
    showTyping(true);
    state.leadId = makeLeadId();
    state.leadSaved = await saveLead();
    showTyping(false);
    busy = false;
    addMessage('assistant', `
      <strong>เรียบร้อยครับ ${safe(state.data.name)}! ผมจัดทำรายงานให้แล้ว 🎉</strong><br>
      ระบบที่แนะนำคือ <strong>${calculate(state.data).size} kW</strong> ด้านขวาจะแสดงผลสรุป ${state.leadSaved ? 'และบันทึกข้อมูลเพื่อให้ผู้เชี่ยวชาญตรวจสอบก่อนติดต่อกลับแล้วครับ' : 'แต่ยังส่งข้อมูลไปยังระบบหลังบ้านไม่ได้ โปรดติดต่อทีมโดยตรงหากต้องการให้ติดต่อกลับครับ'}
    `, true);
    if (!state.leadSaved && !state.demo) showToast('รายงานพร้อมแล้ว แต่ Lead ยังไม่ได้ส่งไปหลังบ้าน', 'i-info');
    updateProgress();
    renderEstimate();
    configureComposer();
    window.setTimeout(openReport, 550);
  }

  function makeLeadId() {
    const now = new Date();
    const date = `${String(now.getUTCFullYear() + 543).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const random = window.crypto?.getRandomValues ? [...window.crypto.getRandomValues(new Uint8Array(8))].map(value => value.toString(16).padStart(2, '0')).join('') : Math.random().toString(16).slice(2).padEnd(16, '0').slice(0, 16);
    return `ZN-${date}-${random}`;
  }

  function getLeadTemperature() {
    const d = state.data;
    if ((d.timeline === '30d' || d.timeline === '3m') && Number(d.bill) >= 3500) return 'Hot Lead';
    if (d.timeline !== 'explore' || Number(d.bill) >= 2500) return 'Warm Lead';
    return 'Nurture';
  }

  async function saveLead() {
    const lead = {
      id: state.leadId,
      createdAt: new Date().toISOString(),
      source: 'ZynerNova AI Chat',
      consent: true,
      status: 'New',
      score: getLeadTemperature(),
      customer: {
        name: state.data.name,
        phone: state.data.phone,
        location: state.data.location
      },
      qualification: {
        monthlyBill: state.data.bill,
        usage: state.data.usage,
        roofArea: state.data.roofArea,
        taxBracket: state.data.tax,
        paymentPreference: state.data.payment,
        timeline: state.data.timeline
      },
      result: calculate(state.data),
      attachments: (state.data.attachments || []).map(attachment => ({ id: attachment.id })),
      conversation: state.conversation
    };

    try {
      const response = await fetch(new URL('leads', API_BASE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
      if (!response.ok) throw new Error(`Lead API returned ${response.status}`);
      const saved = await response.json();
      if (saved.id) state.leadId = saved.id;
      state.leadSaved = saved.saved === true;
    } catch (error) {
      state.leadSaved = false;
      console.warn('Lead could not be saved to the server.', error?.message || 'network error');
    }

    const eventLead = { ...lead, id: state.leadId, saved: state.leadSaved };
    window.dispatchEvent(new CustomEvent('zynernova:lead', { detail: eventLead }));
    const parentOrigin = window.ZYNERNOVA_CONFIG?.parentOrigin || document.querySelector('meta[name="zynernova-parent-origin"]')?.content;
    if (window.parent && window.parent !== window && typeof parentOrigin === 'string' && parentOrigin.trim()) {
      try {
        const targetOrigin = new URL(parentOrigin).origin;
        if (targetOrigin.startsWith('https://') || targetOrigin.startsWith('http://')) {
          window.parent.postMessage({ type: 'ZYNERNOVA_LEAD', payload: eventLead }, targetOrigin);
        }
      } catch (_) {
        console.warn('ZYNERNOVA_CONFIG.parentOrigin is invalid.');
      }
    }
    return state.leadSaved;
  }

  function openReport() {
    if (!state.data.bill || state.current < steps.length) return;
    renderReport();
    openDialog(els.report);
  }

  function renderReport() {
    const d = state.data;
    const c = calculate(d);
    const leadName = safe(d.name || 'ลูกค้าตัวอย่าง');
    const leadId = state.demo ? 'DEMO REPORT · พ.ย. 2569' : `${safe(state.leadId)} · สร้างเมื่อ ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date())}`;
    els.reportId.textContent = leadId;

    const recommendedPlan = c.subsidy > c.taxRefund
      ? 'จ่ายสด + เงินสนับสนุนโซลาร์ภาคประชาชน'
      : (c.taxRefund > 0 ? 'จ่ายสด + สิทธิลดหย่อนภาษี' : 'จ่ายสด');
    const taxPayback = c.savings ? c.taxNet / (c.savings * 12) : 0;
    const subsidyPayback = c.savings ? c.subsidyNet / (c.savings * 12) : 0;
    const cashPayback = c.payback;

    els.reportBody.innerHTML = `
      <section class="report-hero">
        <div>
          <span class="eyebrow">PERSONAL SOLAR REPORT</span>
          <h2>${leadName} บ้านของคุณเหมาะกับระบบ On-grid ${c.size} kW</h2>
          <p>${icon('i-pin')} ${safe(d.location || 'รอยืนยันตำแหน่ง')} · ค่าไฟเฉลี่ย ${fmt(c.bill)} บาท/เดือน</p>
        </div>
        <div class="hero-system"><span>ขนาดระบบแนะนำ</span><strong>${c.size}<small> kW</small></strong><em>คืนทุนเร็วกว่า Hybrid</em></div>
      </section>

      <div class="report-grid">
        <div class="report-stat"><span>ประหยัดต่อเดือน</span><b>${fmt(c.savings)} บาท</b><small>${fmt(c.savings * 12)} บาท/ปี</small></div>
        <div class="report-stat"><span>ผลิตไฟได้</span><b>${fmt(c.production)} หน่วย</b><small>ต่อเดือนโดยประมาณ</small></div>
        <div class="report-stat"><span>จำนวนแผง 585 W</span><b>${fmt(c.panels)} แผง</b><small>ใช้พื้นที่ ${fmt(c.area)} ตร.ม.</small></div>
        <div class="report-stat"><span>กำไรสุทธิ 25 ปี</span><b>${fmt(c.profit25)} บาท</b><small>คิดแผงเสื่อม 0.5%/ปี</small></div>
      </div>

      <section class="report-section">
        <div class="section-head"><div><h3>On-grid เทียบ Hybrid</h3><p>คำนวณจากช่วงเวลาที่ใช้ไฟ: ${safe(d.usageLabel || 'กลางวัน–กลางคืนพอ ๆ กัน')}</p></div><span class="recommend-tag">แนะนำ On-grid</span></div>
        <div class="plan-compare">
          <article class="plan-card recommended">
            <div class="plan-name"><b>On-grid ${c.size} kW</b><span>ไม่มีแบตเตอรี่</span></div>
            <div class="plan-price">${fmt(c.price)} บาท <small>รวม VAT โดยประมาณ</small></div>
            <div class="plan-metrics">
              <span>ประหยัด/เดือน<b>${fmt(c.savings)} บาท</b></span>
              <span>คืนทุนจ่ายสด<b>${c.payback.toFixed(1)} ปี</b></span>
              <span>ใช้ไฟโซลาร์เอง<b>${fmt(c.selfUnits)} หน่วย</b></span>
              <span>ขายไฟส่วนเกิน<b>${fmt(c.exportUnits)} หน่วย</b></span>
            </div>
          </article>
          <article class="plan-card">
            <div class="plan-name"><b>Hybrid + แบตเตอรี่</b><span>สำรองไฟ 5 kWh</span></div>
            <div class="plan-price">${fmt(c.hybridPrice)} บาท <small>รวม VAT โดยประมาณ</small></div>
            <div class="plan-metrics">
              <span>ประหยัด/เดือน<b>${fmt(c.hybridSavings)} บาท</b></span>
              <span>คืนทุนจ่ายสด<b>${c.hybridPayback.toFixed(1)} ปี</b></span>
              <span>ใช้ไฟโซลาร์เอง<b>${fmt(c.hybridSelf)} หน่วย</b></span>
              <span>ส่วนต่างคืนทุน<b>${c.extraBatteryPayback.toFixed(1)} ปี</b></span>
            </div>
          </article>
        </div>
      </section>

      <section class="report-section">
        <div class="section-head"><div><h3>ทางเลือกการจ่ายเงิน</h3><p>สิทธิจริงขึ้นอยู่กับคุณสมบัติและช่วงเวลาที่สมัคร</p></div></div>
        <div class="payment-highlight">
          <div><span>ทางเลือกที่คืนทุนเร็วสุด</span><h4>${recommendedPlan}</h4><p>เงินลงทุนสุทธิโดยประมาณ ${fmt(c.bestNet)} บาท</p></div>
          <div class="payment-return"><b>${c.bestPayback.toFixed(1)} ปี</b><small>ระยะคืนทุนโดยประมาณ</small></div>
        </div>
        <div class="payment-options">
          <article class="payment-option"><b>จ่ายสดราคาปกติ</b><span>ไม่มีภาระผ่อน ประหยัดค่าไฟเต็มทุกเดือน</span><strong>คืนทุน ${cashPayback.toFixed(1)} ปี</strong></article>
          <article class="payment-option"><b>สิทธิลดหย่อนภาษี</b><span>ภาษีคืนโดยประมาณ ${fmt(c.taxRefund)} บาท จากฐานภาษี ${fmt(d.tax)}%</span><strong>คืนทุน ${taxPayback.toFixed(1)} ปี</strong></article>
          <article class="payment-option"><b>สินเชื่อ 2.5% + เงินสนับสนุน</b><span>ผ่อน 7 ปี ประมาณ ${fmt(c.monthlyLoan)} บาท/เดือน</span><strong>เหลือหลังหักค่าไฟ ${fmt(c.netMonthly)} บาท/เดือน</strong></article>
        </div>
      </section>

      <section class="report-section">
        <div class="section-head"><div><h3>ข้อมูลที่พร้อมส่งต่อทีมขาย</h3><p>ลดการถามซ้ำ พร้อมให้ผู้เชี่ยวชาญดูแลต่อได้ทันที</p></div><span class="recommend-tag">${getLeadTemperature()}</span></div>
        <div class="lead-handoff">
          <div class="lead-summary">
            <h4>Lead profile</h4>
            <dl>
              <dt>ชื่อลูกค้า</dt><dd>${leadName}</dd>
              <dt>โทรศัพท์</dt><dd>${safe(formatPhone(d.phone || '—'))}</dd>
              <dt>พื้นที่ติดตั้ง</dt><dd>${safe(d.location || '—')}</dd>
              <dt>พื้นที่หลังคา</dt><dd>${safe(d.roofAreaLabel || 'รอทีมประเมิน')}</dd>
              <dt>การชำระ</dt><dd>${safe(d.paymentLabel || 'ขอเทียบทุกแบบ')}</dd>
              <dt>แผนติดตั้ง</dt><dd>${safe(d.timelineLabel || 'กำลังศึกษาข้อมูล')}</dd>
            </dl>
          </div>
          <div class="next-step">
            <h4>ขั้นตอนถัดไป</h4>
            <ol>
              <li>ผู้เชี่ยวชาญโทรยืนยันบิลและความต้องการ</li>
              <li>ตรวจหลังคา ทิศทาง และเงาบังจากภาพถ่าย/หน้างาน</li>
              <li>ออกแบบระบบและใบเสนอราคาที่รับประกันได้</li>
            </ol>
          </div>
        </div>
      </section>

      <div class="disclaimer">${icon('i-info')}<span><strong>หมายเหตุสำคัญ:</strong> เงินสนับสนุน 50,000 บาทและสิทธิลดหย่อนภาษีใช้ร่วมกันไม่ได้ โครงการเงินสนับสนุนกำหนดระบบ 5–10 kW และมีเงื่อนไขผู้ติดตั้ง/โควตา การลดหย่อนภาษีไม่ใช่เงินคืน 200,000 บาท แต่คิดจากค่าติดตั้งที่เข้าเงื่อนไขคูณฐานภาษี ตัวเลขทั้งหมดเป็นการประมาณการจากข้อมูล พ.ย. 2569 ต้องยืนยันกับหน่วยงาน ธนาคาร และสำรวจหน้างานก่อนตัดสินใจ</span></div>
    `;
  }

  function summaryText() {
    const d = state.data;
    const c = calculate(d);
    return `ลูกค้าใหม่จาก ZynerNova AI\n` +
      `Lead ID: ${state.leadId || 'DEMO'}\n` +
      `ชื่อ: ${d.name || 'ลูกค้าตัวอย่าง'} | โทร: ${formatPhone(d.phone || '—')}\n` +
      `พื้นที่: ${d.location || 'รอยืนยัน'}\n` +
      `ค่าไฟ ${fmt(c.bill)} บาท/เดือน (ประมาณ ${fmt(c.units)} หน่วย)\n` +
      `หลังคา: ${d.roofAreaLabel || 'รอประเมิน'} | ต้องใช้ ${fmt(c.area)} ตร.ม.\n` +
      `ระบบแนะนำ: On-grid ${c.size} kW ราคา ${fmt(c.price)} บาท\n` +
      `ประหยัดประมาณ ${fmt(c.savings)} บาท/เดือน\n` +
      `ทางเลือกคืนทุนเร็ว: ${c.bestBenefit} (${c.bestPayback.toFixed(1)} ปี)\n` +
      `แผนติดตั้ง: ${d.timelineLabel || 'กำลังศึกษา'} | Lead: ${getLeadTemperature()}`;
  }

  async function copySummary() {
    const text = summaryText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    showToast('คัดลอกสรุปสำหรับทีมขายแล้ว');
  }

  function showDemo() {
    closeDialog(els.report);
    state = { current: steps.length, data: { ...sampleData, attachments: [] }, demo: true, leadId: 'DEMO-2569-0042', leadSaved: false, declined: false, conversation: [] };
    busy = false;
    attachmentBusy = false;
    els.messages.innerHTML = '';
    addMessage('assistant', '<strong>เปิดโหมดตัวอย่างแล้วครับ</strong><br>ผมใช้ข้อมูลจำลองของบ้านที่มีค่าไฟ 4,000 บาท/เดือน เพื่อให้คุณเห็นรายงานครบทุกส่วน', true);
    addMessage('user', 'ดูรายงานตัวอย่างสำหรับ On-grid 5 kW');
    addMessage('assistant', 'พร้อมแล้วครับ ด้านขวาคือผลประเมินแบบย่อ และรายงานฉบับเต็มกำลังเปิดให้คุณดู', true);
    updateProgress();
    renderEstimate();
    configureComposer();
    window.setTimeout(openReport, 260);
  }

  function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return value;
  }

  function showToast(message, iconId = 'i-check') {
    window.clearTimeout(toastTimer);
    els.toast.innerHTML = `${icon(iconId)}<span>${safe(message)}</span>`;
    els.toast.classList.add('show');
    toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2400);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadAttachment(file) {
    if (!state.data.consent || state.demo || busy || attachmentBusy) return;
    if (file.size > 8 * 1024 * 1024) return showToast('ขนาดไฟล์ต้องไม่เกิน 8 MB', 'i-info');

    const currentStep = steps[state.current];
    const draft = els.input.value;
    const fileName = String(file.name || 'attachment').slice(0, 100);
    const mimeType = file.type || ({
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
      pdf: 'application/pdf', txt: 'text/plain', mp3: 'audio/mpeg', wav: 'audio/wav',
      m4a: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', aac: 'audio/aac'
    }[fileName.split('.').pop().toLowerCase()] || 'application/octet-stream');
    attachmentBusy = true;
    configureComposer();
    showTyping(true);

    let result = null;
    let failure = '';
    try {
      const dataUrl = await readFileDataUrl(file);
      const response = await fetch(new URL('attachments', API_BASE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          name: fileName,
          mimeType,
          dataUrl,
          step: currentStep?.key || 'followup',
          leadId: state.leadSaved ? state.leadId : ''
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'ส่งไฟล์ไม่สำเร็จ');
      result = payload;
    } catch (error) {
      failure = error?.message || 'ส่งไฟล์ไม่สำเร็จ';
    } finally {
      attachmentBusy = false;
      showTyping(false);
      configureComposer();
      els.input.value = draft;
      els.input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (failure) {
      showToast(failure, 'i-info');
      addMessage('assistant', `แนบไฟล์ไม่สำเร็จครับ ${failure} คุณยังพิมพ์คำตอบเองได้`, false);
      return;
    }

    if (!result?.attachment) return;
    state.data.attachments ||= [];
    state.data.attachments.push(result.attachment);
    addMessage('user', `แนบไฟล์: ${fileName}`, false, true);

    const analysis = result.analysis || {};
    const monthlyBill = Number(analysis.monthlyBill);
    if (currentStep?.key === 'bill' && Number.isFinite(monthlyBill) && monthlyBill >= 500 && monthlyBill <= 100000) {
      submitAnswer(`ยอดค่าไฟจากไฟล์ ${fmt(monthlyBill)} บาท/เดือน`, monthlyBill);
      return;
    }

    if (analysis.transcript) {
      addMessage('assistant', `ถอดเสียงได้ว่า: ${analysis.transcript} กรุณาตรวจสอบข้อความแล้วกดส่งเพื่อยืนยัน`, false);
      if (!state.current || steps[state.current]?.key !== 'consent') {
        els.input.value = analysis.transcript;
        els.input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      const summary = analysis.summary || 'ไฟล์แนบแล้วครับ';
      const next = analysis.status === 'not-configured'
        ? `${summary} กรุณาพิมพ์คำตอบเอง หรือให้ผู้เชี่ยวชาญตรวจสอบไฟล์ภายหลัง`
        : summary;
      addMessage('assistant', next, false);
    }
  }

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    validateAndSubmit();
  });
  els.input.addEventListener('input', () => {
    const step = steps[state.current];
    els.send.disabled = busy || attachmentBusy || step?.key === 'consent' || !els.input.value.trim();
  });
  els.upload.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', () => {
    const file = els.file.files?.[0];
    els.file.value = '';
    if (file) uploadAttachment(file);
  });

  $('#resetBtn').addEventListener('click', () => {
    closeDialog(els.report);
    init();
    showToast('เริ่มการประเมินใหม่แล้ว');
  });
  $('#demoBtn').addEventListener('click', showDemo);
  els.openReportTop.addEventListener('click', openReport);
  $('#closeReportBtn').addEventListener('click', () => closeDialog(els.report));
  $('#copyReportBtn').addEventListener('click', copySummary);
  $('#privacyBtn').addEventListener('click', () => openDialog($('#privacyModal')));
  $('#privacyClose').addEventListener('click', () => closeDialog($('#privacyModal')));
  $('#privacyOkay').addEventListener('click', () => closeDialog($('#privacyModal')));

  [els.report, $('#privacyModal')].forEach(dialog => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDialog(els.report);
      closeDialog($('#privacyModal'));
    }
  });

  init();
})();
