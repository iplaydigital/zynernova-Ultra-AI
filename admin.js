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
  let providers = [];
  let providerPresets = [];
  let providerSettings = {};
  let skills = [];
  let lastPresetBaseUrl = '';
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
    await Promise.all([loadLeads(), loadProviders(), loadSkills(), loadSettings(), loadKnowledge(), loadHealth()]);
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
      $('#systemPrompt').value = settings.systemPrompt || '';
      const summary = $('#activeProviderSummary');
      summary.textContent = settings.activeProviderId
        ? `Provider ที่ใช้งาน: ${settings.activeProviderName} · ${settings.model} · ${settings.baseUrl}${settings.apiKeySource === 'environment' ? ' · ใช้ API key จาก Environment' : ''}`
        : `ยังไม่ได้เลือก Provider เฉพาะ${settings.apiKeyConfigured ? ' · ใช้การตั้งค่า AI เดิมหรือ Environment' : ' · AI ยังไม่มี API key ที่ตั้งค่าไว้'}`;
    } catch (error) {
      setMessage($('#settingsMessage'), error.message, 'error');
    }
  }

  function getProviderLabel(type) {
    return providerPresets.find((preset) => preset.type === type)?.label || type || 'Custom';
  }

  function createProviderButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${className}`;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function renderProviders() {
    const list = $('#providerList');
    list.replaceChildren();
    if (!providers.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state provider-empty';
      empty.textContent = 'ยังไม่มี Provider ที่บันทึกไว้ เพิ่ม Provider เพื่อเลือก Model และเชื่อมต่อ API';
      list.appendChild(empty);
    }

    providers.forEach((provider) => {
      const card = document.createElement('article');
      card.className = `provider-card${provider.active ? ' active' : ''}`;
      const heading = document.createElement('div');
      heading.className = 'provider-card-heading';
      const identity = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = provider.name;
      const type = document.createElement('p');
      type.className = 'muted';
      type.textContent = getProviderLabel(provider.type);
      identity.append(name, type);
      const badge = document.createElement('span');
      badge.className = `provider-badge${provider.active ? ' selected' : ''}`;
      badge.textContent = provider.active ? 'กำลังใช้งาน' : 'ไม่ได้เลือก';
      heading.append(identity, badge);

      const details = document.createElement('div');
      details.className = 'provider-details';
      [
        ['Model', provider.model],
        ['Base URL', provider.baseUrl],
        ['API key', provider.apiKeyConfigured ? `${provider.apiKeySource === 'environment' ? 'Environment' : 'ตั้งค่าแล้ว'}${provider.apiKeyLast4 ? ` · ลงท้าย ${provider.apiKeyLast4}` : ''}` : 'ยังไม่ได้ตั้งค่า']
      ].forEach(([label, value]) => {
        const item = document.createElement('div');
        const caption = document.createElement('small');
        caption.textContent = label;
        const content = document.createElement('span');
        content.textContent = value || '—';
        item.append(caption, content);
        details.appendChild(item);
      });

      const actions = document.createElement('div');
      actions.className = 'provider-actions';
      if (!provider.active) {
        actions.appendChild(createProviderButton('ใช้ Provider นี้', 'button-primary', () => activateProvider(provider.id)));
      }
      const testStatus = document.createElement('span');
      testStatus.className = 'provider-test-status';
      testStatus.setAttribute('role', 'status');
      const testButton = createProviderButton('ทดสอบ', 'button-subtle', () => testProvider(provider.id, testStatus));
      testButton.disabled = !provider.apiKeyConfigured;
      if (!provider.apiKeyConfigured) testButton.title = 'ตั้งค่า API key ก่อนทดสอบ';
      actions.append(testButton, testStatus);
      actions.appendChild(createProviderButton('แก้ไข', 'button-subtle', () => editProvider(provider)));
      actions.appendChild(createProviderButton('ลบ', 'button-danger', () => deleteProvider(provider)));
      card.append(heading, details, actions);
      list.appendChild(card);
    });
  }

  async function loadProviders() {
    try {
      const response = await api('admin/providers');
      providers = Array.isArray(response.providers) ? response.providers : [];
      providerPresets = Array.isArray(response.presets) ? response.presets : [];
      providerSettings = response;
      const notice = $('#providerEnvironmentNotice');
      const overrides = [];
      if (response.apiKeyEnvironmentOverride) overrides.push('API key');
      if (response.modelEnvironmentOverride) overrides.push('Model');
      if (response.baseUrlEnvironmentOverride) overrides.push('Base URL');
      notice.hidden = overrides.length === 0;
      notice.textContent = overrides.length
        ? `ค่าจาก Environment (${overrides.join(', ')}) มีลำดับความสำคัญสูงกว่าค่าของ Provider ที่เลือก`
        : '';
      $('#providerApiKey').disabled = Boolean(response.apiKeyEnvironmentOverride || !response.keyManagementAvailable);
      $('#providerKeyStatus').textContent = response.apiKeyEnvironmentOverride
        ? 'API key ถูกกำหนดจาก Environment; แก้ไขจากหน้าเว็บไม่ได้'
        : response.keyManagementAvailable ? 'กรอก key เพื่อเพิ่มหรือเปลี่ยน key ที่เก็บไว้อย่างปลอดภัย' : 'ต้องตั้งค่า APP_SECRET อย่างน้อย 24 ตัวอักษรก่อนจัดเก็บ API key';
      renderProviders();
    } catch (error) {
      setMessage($('#providerMessage'), error.message, 'error');
    }
  }

  function resetProviderForm() {
    $('#providerForm').reset();
    $('#providerId').value = '';
    $('#providerFormHeading').textContent = 'เพิ่ม Provider';
    $('#providerForm').hidden = true;
    $('#testProvider').hidden = true;
    $('#clearProviderKeyRow').hidden = true;
    $('#providerApiKey').disabled = Boolean(providerSettings.apiKeyEnvironmentOverride || !providerSettings.keyManagementAvailable);
    setMessage($('#providerMessage'), '');
  }

  function openNewProviderForm() {
    resetProviderForm();
    $('#providerForm').hidden = false;
    $('#providerType').value = 'openai';
    const preset = providerPresets.find((item) => item.type === 'openai');
    $('#providerBaseUrl').value = preset?.baseUrl || '';
    lastPresetBaseUrl = preset?.baseUrl || '';
    $('#providerFormHeading').textContent = 'เพิ่ม Provider';
    $('#providerForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#providerName').focus();
  }

  function editProvider(provider) {
    resetProviderForm();
    $('#providerForm').hidden = false;
    $('#providerId').value = provider.id;
    $('#providerName').value = provider.name;
    $('#providerType').value = provider.type;
    $('#providerBaseUrl').value = provider.baseUrl;
    $('#providerModel').value = provider.model;
    $('#providerFormHeading').textContent = `แก้ไข ${provider.name}`;
    $('#providerKeyStatus').textContent = provider.apiKeyConfigured
      ? `${provider.apiKeySource === 'environment' ? 'ใช้ API key จาก Environment' : `ตั้งค่า key แล้ว${provider.apiKeyLast4 ? ` (ลงท้าย ${provider.apiKeyLast4})` : ''}`} · กรอกค่าใหม่เพื่อเปลี่ยน`
      : 'ยังไม่ได้ตั้งค่า API key';
    $('#clearProviderKeyRow').hidden = !provider.apiKeyConfigured || provider.apiKeySource === 'environment';
    $('#testProvider').hidden = false;
    lastPresetBaseUrl = providerPresets.find((item) => item.type === provider.type)?.baseUrl || '';
    $('#providerForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function activateProvider(providerId) {
    try {
      await api('admin/providers/active', { method: 'PUT', body: JSON.stringify({ providerId }) });
      await Promise.all([loadProviders(), loadSettings(), loadHealth()]);
      showToast('เปลี่ยน Provider ที่ใช้งานแล้ว');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function testProvider(providerId, statusElement = $('#providerMessage')) {
    setMessage(statusElement, 'กำลังทดสอบการเชื่อมต่อ…');
    try {
      const result = await api(`admin/providers/${encodeURIComponent(providerId)}/test`, { method: 'POST', body: '{}' });
      setMessage(statusElement, result.message || 'เชื่อมต่อสำเร็จ', 'success');
    } catch (error) {
      setMessage(statusElement, error.message, 'error');
    }
  }

  async function deleteProvider(provider) {
    if (!window.confirm(`ต้องการลบ Provider “${provider.name}” หรือไม่?`)) return;
    try {
      await api(`admin/providers/${encodeURIComponent(provider.id)}`, { method: 'DELETE' });
      await Promise.all([loadProviders(), loadSettings(), loadHealth()]);
      showToast('ลบ Provider แล้ว');
    } catch (error) {
      showToast(error.message);
    }
  }

  function makeSkillField(labelText, name, value, options = {}) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const control = options.multiline ? document.createElement('textarea') : document.createElement('input');
    control.name = name;
    control.value = value || '';
    control.maxLength = options.maxLength;
    if (options.multiline) control.rows = 4;
    label.appendChild(control);
    return label;
  }

  function createSkillCard(skill) {
    const card = document.createElement('article');
    card.className = 'skill-card';
    const heading = document.createElement('div');
    heading.className = 'skill-card-heading';
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'checkbox-row skill-enabled';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.name = 'enabled';
    enabled.checked = Boolean(skill.enabled);
    enabledLabel.append(enabled, document.createTextNode('เปิดใช้ Skill นี้'));
    const remove = createProviderButton('ลบ Skill', 'button-danger', () => card.remove());
    heading.append(enabledLabel, remove);
    const fields = document.createElement('div');
    fields.className = 'skill-fields';
    fields.append(
      makeSkillField('Skill ID', 'id', skill.id, { maxLength: 80 }),
      makeSkillField('ชื่อ Skill', 'name', skill.name, { maxLength: 120 }),
      makeSkillField('คำอธิบาย', 'description', skill.description, { maxLength: 400 }),
      makeSkillField('Instructions', 'instructions', skill.instructions, { maxLength: 3000, multiline: true })
    );
    card.append(heading, fields);
    return card;
  }

  function renderSkills() {
    const list = $('#skillList');
    list.replaceChildren();
    if (!skills.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state provider-empty';
      empty.textContent = 'ยังไม่มี Skill เพิ่มรายการเพื่อกำหนดคำแนะนำให้ผู้ช่วย AI';
      list.appendChild(empty);
      return;
    }
    skills.forEach((skill) => list.appendChild(createSkillCard(skill)));
  }

  async function loadSkills() {
    try {
      const response = await api('admin/skills');
      skills = Array.isArray(response.skills) ? response.skills : [];
      renderSkills();
    } catch (error) {
      setMessage($('#skillsMessage'), error.message, 'error');
    }
  }

  function collectSkills() {
    return [...document.querySelectorAll('.skill-card')].map((card) => ({
      id: card.querySelector('[name="id"]').value.trim(),
      name: card.querySelector('[name="name"]').value.trim(),
      description: card.querySelector('[name="description"]').value.trim(),
      instructions: card.querySelector('[name="instructions"]').value.trim(),
      enabled: card.querySelector('[name="enabled"]').checked
    }));
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

  $('#addProvider').addEventListener('click', openNewProviderForm);
  $('#cancelProvider').addEventListener('click', resetProviderForm);
  $('#providerType').addEventListener('change', () => {
    const current = $('#providerBaseUrl').value.trim();
    const preset = providerPresets.find((item) => item.type === $('#providerType').value);
    if (preset && (!current || current === lastPresetBaseUrl)) $('#providerBaseUrl').value = preset.baseUrl;
    lastPresetBaseUrl = preset?.baseUrl || '';
  });
  $('#providerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#providerMessage');
    setMessage(message, 'กำลังบันทึก Provider…');
    const providerId = $('#providerId').value;
    try {
      await api(providerId ? `admin/providers/${encodeURIComponent(providerId)}` : 'admin/providers', {
        method: providerId ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: $('#providerName').value.trim(),
          type: $('#providerType').value,
          baseUrl: $('#providerBaseUrl').value.trim(),
          model: $('#providerModel').value.trim(),
          apiKey: $('#providerApiKey').value,
          clearApiKey: $('#clearProviderApiKey').checked
        })
      });
      resetProviderForm();
      await Promise.all([loadProviders(), loadSettings(), loadHealth()]);
      showToast('บันทึก Provider แล้ว');
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
  $('#testProvider').addEventListener('click', () => {
    const providerId = $('#providerId').value;
    if (providerId) testProvider(providerId);
  });

  $('#addSkill').addEventListener('click', () => {
    const uniqueId = `skill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    $('#skillList').appendChild(createSkillCard({ id: uniqueId, name: '', description: '', instructions: '', enabled: false }));
  });
  $('#saveSkills').addEventListener('click', async () => {
    const message = $('#skillsMessage');
    setMessage(message, 'กำลังบันทึก Skills…');
    try {
      const response = await api('admin/skills', {
        method: 'PUT',
        body: JSON.stringify({ skills: collectSkills() })
      });
      skills = response.skills;
      renderSkills();
      setMessage(message, 'บันทึก Skills แล้ว', 'success');
      showToast('บันทึก Skills แล้ว');
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#settingsMessage');
    setMessage(message, 'กำลังบันทึก…');
    try {
      await api('admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ systemPrompt: $('#systemPrompt').value })
      });
      setMessage(message, 'System Prompt ถูกบันทึกแล้ว', 'success');
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
