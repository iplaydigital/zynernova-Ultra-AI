'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  createApplication,
  normalizeBasePath,
  normalizeApiBaseUrl,
  encryptSecret,
  decryptSecret,
  rankKnowledge,
  makeLeadId,
  isValidLeadId
} = require('../server');

const ADMIN_PASSWORD = 'test-admin-password-long-enough';
const APP_SECRET = 'unit-test-secret-at-least-24-characters';

async function createTestApp(t, overrides = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zynernova-test-'));
  const app = createApplication({
    basePath: '/ai',
    dataDir,
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test',
    adminPassword: ADMIN_PASSWORD,
    appSecret: APP_SECRET,
    ...overrides
  });
  await app.initialize();
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  return { app, baseUrl, dataDir };
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/ai/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  return { response, cookie };
}

const validLead = (overrides = {}) => ({
  id: makeLeadId(),
  consent: true,
  score: 'Warm Lead',
  customer: { name: 'ทดสอบ ลูกค้า', phone: '0891234567', location: 'กรุงเทพฯ' },
  qualification: { monthlyBill: 4000, usage: 'mixed', roofArea: 40, taxBracket: 20, paymentPreference: 'both', timeline: '3m' },
  result: { size: 5, savings: 2200, price: 139000 },
  attachments: [],
  conversation: [{ role: 'user', step: 'bill', content: 'ค่าไฟ 4,000 บาท' }],
  ...overrides
});

test('base path, API base URL, and lead IDs are normalized/validated', () => {
  assert.equal(normalizeBasePath('/ai/'), '/ai');
  assert.equal(normalizeBasePath('/'), '');
  assert.throws(() => normalizeBasePath('ai'), /BASE_PATH/);
  assert.equal(normalizeApiBaseUrl('https://api.example.com/v1/'), 'https://api.example.com/v1');
  assert.throws(() => normalizeApiBaseUrl('http://api.example.com/v1', true), /HTTPS/);
  assert.throws(() => normalizeApiBaseUrl('https://user:pass@example.com/v1'), /username/);
  const id = makeLeadId();
  assert.match(id, /^ZN-\d{6}-[a-f0-9]{16}$/);
  assert.equal(isValidLeadId(id), true);
  assert.equal(isValidLeadId('ZN-256901-1234'), false);
  assert.throws(() => createApplication({ nodeEnv: 'production', adminPassword: '', appSecret: '' }), /ADMIN_PASSWORD/);
  assert.throws(() => createApplication({
    nodeEnv: 'production',
    adminPassword: 'a-production-password-over-16-characters',
    appSecret: 'a-production-app-secret-with-more-than-32-characters',
    frameAncestors: '*'
  }), /FRAME_ANCESTORS/);
});

test('API key encryption authenticates ciphertext and rejects wrong secrets', () => {
  const ciphertext = encryptSecret('sk-example-key-do-not-use', APP_SECRET);
  assert.notEqual(ciphertext, 'sk-example-key-do-not-use');
  assert.equal(decryptSecret(ciphertext, APP_SECRET), 'sk-example-key-do-not-use');
  assert.throws(() => decryptSecret(ciphertext, 'a-different-secret-that-is-long-enough'));
});

test('keyword retrieval returns matching knowledge entries in rank order', () => {
  const entries = [
    { id: 'tax', title: 'ภาษีและสิทธิ', content: 'ตรวจสอบเงื่อนไขภาษีก่อนยืนยัน', tags: ['ภาษี'] },
    { id: 'solar', title: 'โซลาร์', content: 'ประเมินการใช้ไฟและแผงโซลาร์', tags: ['โซลาร์'] }
  ];
  assert.equal(rankKnowledge(entries, 'ภาษี ภาษี', 2)[0].id, 'tax');
  assert.deepEqual(rankKnowledge(entries, 'คำที่ไม่มีในคลัง', 2), []);
});

test('static site and subpath routes are served without exposing private files', async (t) => {
  const { baseUrl } = await createTestApp(t);
  const home = await fetch(`${baseUrl}/ai/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.match(await home.text(), /ZynerNova AI/);

  const admin = await fetch(`${baseUrl}/ai/admin/`);
  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /เข้าสู่ระบบหลังบ้าน/);
  const adminRedirect = await fetch(`${baseUrl}/ai/admin`, { redirect: 'manual' });
  assert.equal(adminRedirect.status, 308);
  assert.equal(adminRedirect.headers.get('location'), '/ai/admin/');

  const image = await fetch(`${baseUrl}/ai/assets/ultra-avatar.svg`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/svg\+xml/);

  const rootRedirect = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  assert.equal(rootRedirect.status, 302);
  assert.equal(rootRedirect.headers.get('location'), '/ai/');
  assert.equal((await fetch(`${baseUrl}/ai/server.js`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/ai/data/leads.json`)).status, 404);
});

test('AI routes require consent and degrade cleanly when no provider is configured', async (t) => {
  const { baseUrl } = await createTestApp(t);
  const health = await fetch(`${baseUrl}/ai/api/health`).then((response) => response.json());
  assert.equal(health.ok, true);
  assert.equal(health.aiConfigured, false);

  const denied = await fetch(`${baseUrl}/ai/api/assistant`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: false, step: 'bill', answer: '4000', nextStep: 'usage' })
  });
  assert.equal(denied.status, 403);

  const assistant = await fetch(`${baseUrl}/ai/api/assistant`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, step: 'bill', answer: '4000', nextStep: 'usage', context: { bill: 4000 } })
  });
  assert.equal(assistant.status, 200);
  assert.deepEqual(await assistant.json(), { configured: false, reply: '' });

  const chat = await fetch(`${baseUrl}/ai/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, message: 'ถามเรื่องระบบโซลาร์', context: {} })
  });
  assert.equal(chat.status, 200);
  assert.equal((await chat.json()).configured, false);
});

test('admin login, encrypted settings, and authenticated API access work', async (t) => {
  const { baseUrl, dataDir } = await createTestApp(t);
  const unauthorized = await fetch(`${baseUrl}/ai/api/admin/settings`);
  assert.equal(unauthorized.status, 401);

  const wrong = await fetch(`${baseUrl}/ai/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' })
  });
  assert.equal(wrong.status, 401);

  const { response: loginResponse, cookie } = await login(baseUrl);
  assert.equal(loginResponse.status, 200);
  assert.ok(cookie);

  const settingsResponse = await fetch(`${baseUrl}/ai/api/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-example-key-do-not-use',
      systemPrompt: 'You are a safe solar assistant that answers in Thai.'
    })
  });
  assert.equal(settingsResponse.status, 200);
  const responseBody = await settingsResponse.json();
  assert.equal(responseBody.settings.apiKeyConfigured, true);
  assert.equal(responseBody.settings.apiKeyLast4, '-use');
  assert.equal(JSON.stringify(responseBody).includes('sk-example-key-do-not-use'), false);

  const stored = await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8');
  assert.equal(stored.includes('sk-example-key-do-not-use'), false);
  assert.equal(decryptSecret(JSON.parse(stored).encryptedApiKey, APP_SECRET), 'sk-example-key-do-not-use');

  const logout = await fetch(`${baseUrl}/ai/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(`${baseUrl}/ai/api/admin/settings`, { headers: { Cookie: cookie } })).status, 401);
});

test('Lead API requires consent and provides the saved lead only to admin', async (t) => {
  const { baseUrl } = await createTestApp(t);
  const lead = validLead();
  const denied = await fetch(`${baseUrl}/ai/api/leads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lead, consent: false })
  });
  assert.equal(denied.status, 400);

  const saved = await fetch(`${baseUrl}/ai/api/leads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead)
  });
  assert.equal(saved.status, 201);
  const savedBody = await saved.json();
  assert.equal(savedBody.saved, true);
  assert.equal(savedBody.id, lead.id);

  const { cookie } = await login(baseUrl);
  const response = await fetch(`${baseUrl}/ai/api/admin/leads`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.leads.length, 1);
  assert.equal(body.leads[0].customer.phone, '0891234567');
  assert.equal(body.leads[0].conversation[0].content, 'ค่าไฟ 4,000 บาท');
});

test('attachments are private, validated, and linked to a consented Lead', async (t) => {
  const { baseUrl } = await createTestApp(t);
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mioAAAAASUVORK5CYII=';
  const upload = await fetch(`${baseUrl}/ai/api/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, name: 'bill.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${pngBase64}`, step: 'bill' })
  });
  assert.equal(upload.status, 201);
  const { attachment, analysis } = await upload.json();
  assert.equal(attachment.mimeType, 'image/png');
  assert.equal(analysis.status, 'not-configured');

  const bad = await fetch(`${baseUrl}/ai/api/attachments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, name: 'bad.svg', mimeType: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' })
  });
  assert.equal(bad.status, 415);

  const lead = validLead({ attachments: [{ id: attachment.id }] });
  const saveResponse = await fetch(`${baseUrl}/ai/api/leads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead)
  });
  assert.equal(saveResponse.status, 201);
  const { cookie } = await login(baseUrl);
  const download = await fetch(`${baseUrl}/ai/api/admin/attachments/${attachment.id}`, { headers: { Cookie: cookie } });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal((await download.arrayBuffer()).byteLength, Buffer.from(pngBase64, 'base64').length);

  const privateDownload = await fetch(`${baseUrl}/ai/api/admin/attachments/${attachment.id}`);
  assert.equal(privateDownload.status, 401);
});

test('admin Knowledge Base validation rejects duplicate or malformed entries', async (t) => {
  const { baseUrl } = await createTestApp(t);
  const { cookie } = await login(baseUrl);
  const response = await fetch(`${baseUrl}/ai/api/admin/knowledge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ entries: [
      { id: 'policy', title: 'นโยบาย', content: 'ตรวจสอบก่อนยืนยัน', tags: ['ภาษี'], reviewStatus: 'needs-review' }
    ] })
  });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.knowledge.entries[0].reviewStatus, 'needs-review');

  const duplicate = await fetch(`${baseUrl}/ai/api/admin/knowledge`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ entries: [
      { id: 'same', title: 'A', content: 'Content' },
      { id: 'same', title: 'B', content: 'Content' }
    ] })
  });
  assert.equal(duplicate.status, 400);
});

test('admin can manage encrypted Providers, activate and test one, and apply enabled Skills to chat', async (t) => {
  const requests = [];
  const { baseUrl, dataDir } = await createTestApp(t, {
    fetch: async (url, options) => {
      requests.push({ url: String(url), options, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });
  assert.equal((await fetch(`${baseUrl}/ai/api/admin/providers`)).status, 401);
  const { cookie } = await login(baseUrl);
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };

  const initialProviders = await fetch(`${baseUrl}/ai/api/admin/providers`, { headers }).then((response) => response.json());
  assert.deepEqual(initialProviders.providers, []);
  assert.deepEqual(initialProviders.presets.map((preset) => preset.type), ['openai', 'openrouter', 'compatible']);

  const defaults = await fetch(`${baseUrl}/ai/api/admin/skills`, { headers }).then((response) => response.json());
  assert.equal(defaults.skills.length, 3);
  assert.ok(defaults.skills.every((skill) => skill.enabled));

  const createdResponse = await fetch(`${baseUrl}/ai/api/admin/providers`, {
    method: 'POST', headers,
    body: JSON.stringify({
      name: 'Test OpenAI-compatible', type: 'compatible', baseUrl: 'https://model.example/v1',
      model: 'solar-model-v1', apiKey: 'sk-provider-test-secret'
    })
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const providerId = created.provider.id;
  assert.equal(created.provider.apiKeyConfigured, true);
  assert.equal(created.provider.apiKeyLast4, 'cret');
  assert.equal(JSON.stringify(created).includes('sk-provider-test-secret'), false);
  const storedSettings = JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8'));
  const storedProvider = storedSettings.providers.find((provider) => provider.id === providerId);
  assert.equal(storedProvider.encryptedApiKey.includes('sk-provider-test-secret'), false);
  assert.equal(decryptSecret(storedProvider.encryptedApiKey, APP_SECRET), 'sk-provider-test-secret');

  const activate = await fetch(`${baseUrl}/ai/api/admin/providers/active`, {
    method: 'PUT', headers, body: JSON.stringify({ providerId })
  });
  assert.equal(activate.status, 200);
  const selectedSettings = await fetch(`${baseUrl}/ai/api/admin/settings`, { headers }).then((response) => response.json());
  assert.equal(selectedSettings.settings.activeProviderId, providerId);
  assert.equal(selectedSettings.settings.activeProviderName, 'Test OpenAI-compatible');
  assert.equal(selectedSettings.settings.model, 'solar-model-v1');

  const testConnection = await fetch(`${baseUrl}/ai/api/admin/providers/${providerId}/test`, {
    method: 'POST', headers, body: '{}'
  });
  assert.equal(testConnection.status, 200);
  assert.equal(requests[0].url, 'https://model.example/v1/chat/completions');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer sk-provider-test-secret');

  const savedSkills = await fetch(`${baseUrl}/ai/api/admin/skills`, {
    method: 'PUT', headers,
    body: JSON.stringify({ skills: [
      { id: 'solar-style', name: 'Solar Style', description: 'Tone rules', instructions: 'Always explain that estimates are preliminary.', enabled: true }
    ] })
  });
  assert.equal(savedSkills.status, 200);
  assert.equal((await savedSkills.json()).skills[0].enabled, true);

  const chat = await fetch(`${baseUrl}/ai/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, message: 'ช่วยประเมินโซลาร์', context: {} })
  });
  assert.equal(chat.status, 200);
  assert.equal((await chat.json()).reply, 'OK');
  const chatRequest = requests[1];
  assert.match(chatRequest.body.messages[0].content, /Always explain that estimates are preliminary/);
  assert.equal(chatRequest.body.model, 'solar-model-v1');

  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mioAAAAASUVORK5CYII=';
  const upload = await fetch(`${baseUrl}/ai/api/attachments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, name: 'bill.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${pngBase64}` })
  });
  assert.equal(upload.status, 201);
  assert.equal((await upload.json()).analysis.status, 'analyzed');
  assert.match(requests[2].body.messages[0].content, /Always explain that estimates are preliminary/);

  const duplicateSkill = await fetch(`${baseUrl}/ai/api/admin/skills`, {
    method: 'PUT', headers,
    body: JSON.stringify({ skills: [
      { id: 'repeat', name: 'First', instructions: 'One' },
      { id: 'repeat', name: 'Second', instructions: 'Two' }
    ] })
  });
  assert.equal(duplicateSkill.status, 400);

  const deleted = await fetch(`${baseUrl}/ai/api/admin/providers/${providerId}`, { method: 'DELETE', headers });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).providers.length, 0);
  const health = await fetch(`${baseUrl}/ai/api/health`).then((response) => response.json());
  assert.equal(health.aiConfigured, false);
});

test('legacy AI settings migrate into a managed Provider without losing the encrypted key', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zynernova-migration-'));
  const legacyKey = encryptSecret('legacy-provider-key', APP_SECRET);
  await fs.writeFile(path.join(dataDir, 'settings.json'), JSON.stringify({
    baseUrl: 'https://legacy.example/v1', model: 'legacy-model', encryptedApiKey: legacyKey,
    systemPrompt: 'A legacy system prompt that is long enough.'
  }));
  const app = createApplication({
    basePath: '/ai', dataDir, host: '127.0.0.1', port: 0, nodeEnv: 'test',
    adminPassword: ADMIN_PASSWORD, appSecret: APP_SECRET
  });
  await app.initialize();
  await app.listen(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const { cookie } = await login(baseUrl);
  const headers = { Cookie: cookie };
  const managed = await fetch(`${baseUrl}/ai/api/admin/providers`, { headers }).then((response) => response.json());
  assert.equal(managed.providers.length, 1);
  assert.equal(managed.providers[0].name, 'Imported legacy provider');
  assert.equal(managed.providers[0].active, true);
  assert.equal(managed.providers[0].apiKeyConfigured, true);
  const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8'));
  assert.equal(Object.hasOwn(stored, 'encryptedApiKey'), false);
  assert.equal(decryptSecret(stored.providers[0].encryptedApiKey, APP_SECRET), 'legacy-provider-key');
});

test('Provider credentials and model settings respect environment overrides', async (t) => {
  const { baseUrl } = await createTestApp(t, {
    aiApiKey: 'environment-api-key', aiBaseUrl: 'https://env.example/v1', aiModel: 'environment-model'
  });
  const { cookie } = await login(baseUrl);
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  const created = await fetch(`${baseUrl}/ai/api/admin/providers`, {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'Environment-backed', type: 'openai', model: 'stored-model' })
  });
  assert.equal(created.status, 201);
  const { provider } = await created.json();
  assert.equal(provider.apiKeyConfigured, true);
  assert.equal(provider.apiKeySource, 'environment');

  const active = await fetch(`${baseUrl}/ai/api/admin/providers/active`, {
    method: 'PUT', headers, body: JSON.stringify({ providerId: provider.id })
  });
  assert.equal(active.status, 200);
  const settings = await fetch(`${baseUrl}/ai/api/admin/settings`, { headers }).then((response) => response.json());
  assert.equal(settings.settings.baseUrl, 'https://env.example/v1');
  assert.equal(settings.settings.model, 'environment-model');
  assert.equal(settings.settings.apiKeySource, 'environment');

  const attemptedKeyChange = await fetch(`${baseUrl}/ai/api/admin/providers/${provider.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ name: 'Environment-backed', type: 'openai', model: 'stored-model', apiKey: 'should-not-save' })
  });
  assert.equal(attemptedKeyChange.status, 400);
});
