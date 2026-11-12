(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const API_BASE = new URL('../api/', document.baseURI).href;
  const loginView = $('#loginView');
  const dashboard = $('#dashboard');
  const loginMessage = $('#loginMessage');
  const toast = $('#adminToast');
  let leads = [];
  let activeLeadId = '';
  let toastTimer;

  async function api(path, options = {}) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const response = await fetch(new URL(path, API_BASE), {
      credentials: 'same-origin',
      ...options,
      headers
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
    return payload;
  }

  function setMessage(element, message, type = '') {
    element.textContent = message;
    element.className = `form-message${type ? ` ${type}` : ''}`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function showLogin(configured) {
    loginView.hidden = false;
    dashboard.hidden = true;
    $('#logoutButton').hidden = true;
    $('#adminSetupNote').hidden = configured;
    if (!configured) {
      loginMessage.textContent = 'หลังบ้านยังไม่ได้เปิดใช้งาน';
    }
  }

  async function showDashboard() {
    loginView.hidden = true;
    dashboard.hidden = false;
    $('#logoutButton').hidden = false;
    await Promise.all([loadLeads(), loadSettings(), loadKnowledge(), loadHealth()]);
  }

  async function checkSession() {
    try {
      const session = await api('admin/session');
      if (!session.adminConfigured) return showLogin(false);
      if (session.authenticated) return showDashboard();
      return showLogin(true);
    } catch (error) {
      showLogin(true);
      setMessage(loginMessage, error.message, 'error');
    }
  }

  async function loadHealth() {
    try {
      const health = await api('health');
      const status = $('#modelStatus');
      status.classList.toggle('ready', Boolean(health.aiConfigured));
      status.querySelector('i').setAttribute('aria-hidden', 'true');
      status.lastChild.textContent = health.aiConfigured ? ' AI พร้อมใช้งาน' : ' ยังไม่ได้ตั้งค่า AI';
    } catch (_) {
      const status = $('#modelStatus');
      status.classList.remove('ready');
      status.lastChild.textContent = ' ไม่พบ API';
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ไม่ระบุเวลา';
    return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(number) : '—';
  }

  function leadSearchText(lead) {
    return [lead.customer?.name, lead.customer?.phone, lead.customer?.location, lead.id, lead.score]
      .join(' ').toLocaleLowerCase('th-TH');
  }

  function renderLeadList() {
    const list = $('#leadList');
    const query = $('#leadSearch').value.trim().toLocaleLowerCase('th-TH');
    const filtered = leads.filter((lead) => !query || leadSearchText(lead).includes(query));
    $('#leadCount').textContent = String(filtered.length);
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = '38px 14px';
      empty.textContent = leads.length ? 'ไม่พบ Lead ที่ตรงกับคำค้นหา' : 'ยังไม่มี Lead ที่บันทึก';
      list.appendChild(empty);
      return;
    }

    filtered.forEach((lead) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `lead-row${lead.id === activeLeadId ? ' active' : ''}`;
      const name = document.createElement('strong');
      name.textContent = lead.customer?.name || 'ไม่ระบุชื่อ';
      const meta = document.createElement('small');
      meta.textContent = `${lead.customer?.phone || '—'} · ${formatDate(lead.createdAt)}`;
      const badge = document.createElement('span');
      badge.className = 'lead-badge';
      badge.textContent = lead.score || 'Lead';
      button.append(name, meta, badge);
      button.addEventListener('click', () => {
        activeLeadId = lead.id;
        renderLeadList();
        renderLeadDetail(lead);
      });
      list.appendChild(button);
    });
  }

  async function loadLeads() {
    const list = $('#leadList');
    list.textContent = 'กำลังโหลดรายการ…';
    try {
      const response = await api('admin/leads?limit=500');
      leads = Array.isArray(response.leads) ? response.leads : [];
      if (!leads.some((lead) => lead.id === activeLeadId)) activeLeadId = '';
      renderLeadList();
      if (activeLeadId) renderLeadDetail(leads.find((lead) => lead.id === activeLeadId));
      else {
        const detail = $('#leadDetail');
        detail.classList.add('empty-detail');
        detail.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<span>↖</span><b>เลือก Lead เพื่อดูรายละเอียด</b><p>ประวัติคำตอบ ผลประเมิน และไฟล์แนบจะแสดงที่นี่</p>';
        detail.appendChild(empty);
      }
    } catch (error) {
      list.textContent = `โหลดรายการไม่สำเร็จ: ${error.message}`;
    }
  }

  function createDetailSection(title) {
    const section = document.createElement('section');
    section.className = 'detail-section';
    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  function addDetailStat(container, label, value) {
    const card = document.createElement('div');
    card.className = 'detail-stat';
    const name = document.createElement('span');
    name.textContent = label;
    const content = document.createElement('b');
    content.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
    card.append(name, content);
    container.appendChild(card);
  }

  function addTableRow(tableBody, label, value) {
    const row = document.createElement('tr');
    const head = document.createElement('th');
    const cell = document.createElement('td');
    head.textContent = label;
    cell.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
    row.append(head, cell);
    tableBody.appendChild(row);
  }

  function renderLeadDetail(lead) {
    const detail = $('#leadDetail');
    if (!lead) return;
    detail.classList.remove('empty-detail');
    detail.replaceChildren();

    const header = document.createElement('div');
    header.className = 'detail-head';
    const identity = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = lead.customer?.name || 'ไม่ระบุชื่อ';
    const meta = document.createElement('p');
    meta.textContent = `${lead.id} · ${formatDate(lead.createdAt)}`;
    identity.append(heading, meta);
    const badge = document.createElement('span');
    badge.className = 'lead-badge';
    badge.textContent = lead.score || 'Lead';
    header.append(identity, badge);
    detail.appendChild(header);

    const stats = document.createElement('div');
    stats.className = 'detail-grid';
    addDetailStat(stats, 'ค่าไฟ / เดือน', `${formatNumber(lead.qualification?.monthlyBill)} บาท`);
    addDetailStat(stats, 'ระบบแนะนำ', `${formatNumber(lead.result?.size)} kW`);
    addDetailStat(stats, 'ประหยัด / เดือน', `${formatNumber(lead.result?.savings)} บาท`);
    addDetailStat(stats, 'สถานะ', lead.status || 'New');
    detail.appendChild(stats);

    const customerSection = createDetailSection('ข้อมูลติดต่อและการคัดกรอง');
    const customerTable = document.createElement('table');
    customerTable.className = 'detail-table';
    const customerBody = document.createElement('tbody');
    addTableRow(customerBody, 'โทรศัพท์', lead.customer?.phone);
    addTableRow(customerBody, 'พื้นที่', lead.customer?.location);
    addTableRow(customerBody, 'ช่วงใช้ไฟ', lead.qualification?.usage);
    addTableRow(customerBody, 'พื้นที่หลังคา', lead.qualification?.roofArea);
    addTableRow(customerBody, 'ฐานภาษี', lead.qualification?.taxBracket === undefined ? '' : `${lead.qualification.taxBracket}%`);
    addTableRow(customerBody, 'การชำระ', lead.qualification?.paymentPreference);
    addTableRow(customerBody, 'กำหนดติดตั้ง', lead.qualification?.timeline);
    customerTable.appendChild(customerBody);
    customerSection.appendChild(customerTable);
    detail.appendChild(customerSection);

    const attachments = Array.isArray(lead.attachments) ? lead.attachments : [];
    const fileSection = createDetailSection(`ไฟล์แนบ (${attachments.length})`);
    if (attachments.length) {
      attachments.forEach((file) => {
        const anchor = document.createElement('a');
        anchor.className = 'attachment-link';
        anchor.href = new URL(`admin/attachments/${encodeURIComponent(file.id)}`, API_BASE).href;
        anchor.textContent = `${file.name || 'ไฟล์แนบ'} · ${formatNumber(file.size / 1024)} KB`;
        anchor.setAttribute('download', file.name || 'attachment');
        fileSection.appendChild(anchor);
        if (file.analysis?.summary) {
          const summary = document.createElement('p');
          summary.className = 'muted';
          summary.textContent = file.analysis.summary;
          fileSection.appendChild(summary);
        }
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'ไม่มีไฟล์แนบ';
      fileSection.appendChild(empty);
    }
    detail.appendChild(fileSection);

    const conversation = Array.isArray(lead.conversation) ? lead.conversation : [];
    const conversationSection = createDetailSection(`ประวัติการสนทนา (${conversation.length})`);
    const conversationList = document.createElement('div');
    conversationList.className = 'conversation-list';
    if (conversation.length) {
      conversation.forEach((message) => {
        const entry = document.createElement('div');
        entry.className = `conversation-entry ${message.role === 'assistant' ? 'assistant' : 'user'}`;
        const label = document.createElement('small');
        label.textContent = `${message.role === 'assistant' ? 'น้อง Ultra' : 'ลูกค้า'} · ${message.step || ''}`;
        const content = document.createElement('div');
        content.textContent = message.content || '';
        entry.append(label, content);
        conversationList.appendChild(entry);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'ไม่มีประวัติข้อความเพิ่มเติม';
      conversationList.appendChild(empty);
    }
    conversationSection.appendChild(conversationList);
    detail.appendChild(conversationSection);
  }

  async function loadSettings() {
    try {
      const response = await api('admin/settings');
      const settings = response.settings;
      $('#aiBaseUrl').value = settings.baseUrl || '';
      $('#aiModel').value = settings.model || '';
      $('#systemPrompt').value = settings.systemPrompt || '';
      $('#aiApiKey').value = '';
      $('#clearApiKey').checked = false;
      const keyStatus = $('#apiKeyStatus');
      if (settings.apiKeyConfigured) {
        keyStatus.textContent = settings.apiKeySource === 'environment'
          ? 'ใช้ AI_API_KEY จาก Environment; จะไม่เปิดเผยค่าของ key'
          : `ตั้งค่า key แล้ว${settings.apiKeyLast4 ? ` (ลงท้าย ${settings.apiKeyLast4})` : ''}`;
      } else {
        keyStatus.textContent = settings.keyManagementAvailable
          ? 'ยังไม่ได้ตั้งค่า API key'
          : 'ยังไม่ได้ตั้งค่า APP_SECRET สำหรับเข้ารหัส key';
      }
      $('#aiApiKey').disabled = settings.apiKeySource === 'environment' || !settings.keyManagementAvailable;
    } catch (error) {
      setMessage($('#settingsMessage'), error.message, 'error');
    }
  }

  async function loadKnowledge() {
    try {
      const response = await api('admin/knowledge');
      $('#knowledgeEditor').value = JSON.stringify(response.knowledge, null, 2);
    } catch (error) {
      setMessage($('#knowledgeMessage'), error.message, 'error');
    }
  }

  function activatePanel(panelId) {
    document.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.panel === panelId);
    });
    document.querySelectorAll('.panel').forEach((panel) => {
      const active = panel.id === panelId;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const passwordInput = $('#loginPassword');
    setMessage(loginMessage, 'กำลังตรวจสอบ…');
    try {
      await api('admin/login', { method: 'POST', body: JSON.stringify({ password: passwordInput.value }) });
      passwordInput.value = '';
      setMessage(loginMessage, '');
      await showDashboard();
    } catch (error) {
      setMessage(loginMessage, error.message, 'error');
      passwordInput.select();
    }
  });

  $('#logoutButton').addEventListener('click', async () => {
    try { await api('admin/logout', { method: 'POST', body: '{}' }); } catch (_) { /* session may have expired */ }
    showLogin(true);
    showToast('ออกจากระบบแล้ว');
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => activatePanel(button.dataset.panel));
  });
  $('#refreshLeads').addEventListener('click', loadLeads);
  $('#leadSearch').addEventListener('input', renderLeadList);

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#settingsMessage');
    setMessage(message, 'กำลังบันทึก…');
    try {
      const response = await api('admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          baseUrl: $('#aiBaseUrl').value.trim(),
          model: $('#aiModel').value.trim(),
          apiKey: $('#aiApiKey').value,
          clearApiKey: $('#clearApiKey').checked,
          systemPrompt: $('#systemPrompt').value
        })
      });
      $('#aiApiKey').value = '';
      $('#clearApiKey').checked = false;
      setMessage(message, 'การตั้งค่าถูกบันทึกแล้ว', 'success');
      const keyStatus = $('#apiKeyStatus');
      keyStatus.textContent = response.settings.apiKeyConfigured
        ? `ตั้งค่า key แล้ว${response.settings.apiKeyLast4 ? ` (ลงท้าย ${response.settings.apiKeyLast4})` : ''}`
        : 'ยังไม่ได้ตั้งค่า API key';
      await loadHealth();
      showToast('บันทึกการตั้งค่าแล้ว');
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });

  $('#saveKnowledge').addEventListener('click', async () => {
    const message = $('#knowledgeMessage');
    setMessage(message, 'กำลังตรวจสอบ JSON…');
    try {
      const knowledge = JSON.parse($('#knowledgeEditor').value);
      const response = await api('admin/knowledge', {
        method: 'PUT',
        body: JSON.stringify({ entries: knowledge.entries })
      });
      $('#knowledgeEditor').value = JSON.stringify(response.knowledge, null, 2);
      setMessage(message, 'บันทึกคลังความรู้แล้ว', 'success');
      showToast('บันทึกคลังความรู้แล้ว');
    } catch (error) {
      setMessage(message, error instanceof SyntaxError ? 'JSON ไม่ถูกต้อง กรุณาตรวจสอบวงเล็บและเครื่องหมายคำพูด' : error.message, 'error');
    }
  });

  checkSession();
})();
