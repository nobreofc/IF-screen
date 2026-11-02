// Teste de integração do servidor-ponte: node test.js
'use strict';
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PORT = '0';
process.env.CENTRAL_KEY = 'central-teste';
process.env.APP_KEY = 'app-teste';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-'));
const { server } = require('./server.js');

async function main() {
  await new Promise((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, {
      method, headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
  const dev = { deviceId: 'dev-1', code: 'IFS-AB12-CD34', token: 'x'.repeat(32) };
  const dh = { 'x-device-id': dev.deviceId, 'x-device-token': dev.token };
  const ch = { Authorization: 'Bearer central-teste' };

  assert.equal((await j('POST', '/api/v1/device/register', dev, { 'x-app-key': 'errada' })).status, 401);
  assert.equal((await j('POST', '/api/v1/device/register', dev, { 'x-app-key': 'app-teste' })).status, 200);
  assert.equal((await j('POST', '/api/v1/device/register', { ...dev, token: 'y'.repeat(32) }, { 'x-app-key': 'app-teste' })).status, 409);
  assert.equal((await j('POST', '/api/v1/device/ingest', {}, { ...dh, 'x-device-token': 'z'.repeat(32) })).status, 401);

  const day = { date: '2026-10-20', computedAt: 1000, screenMs: 3600000, sessions: [[1, 2]] };
  let r = await j('POST', '/api/v1/device/ingest', { days: [day], questionnaires: [{ refDate: '2026-10-19', answeredAt: 5, tv: true, tvMin: 60 }], heartbeat: { a: 1 } }, dh);
  assert.equal(r.body.accepted, 2);
  r = await j('POST', '/api/v1/device/ingest', { days: [day] }, dh); // mesma versão: ignorado
  assert.equal(r.body.accepted, 0);

  r = await j('GET', '/api/v1/central/pull?after=0', null, ch);
  assert.equal(r.status, 200);
  const kinds = r.body.items.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ['day', 'hb', 'q', 'register']);

  r = await j('POST', '/api/v1/central/ack', { acks: [{ deviceId: 'dev-1', kind: 'day', key: '2026-10-20', version: 1000 }] }, ch);
  assert.equal(r.body.acked, 1);
  r = await j('POST', '/api/v1/central/links', { links: [{ deviceId: 'dev-1', linked: true, participant: 'P001' }], config: { questionHour: 8, reminderHour: 21, showScreenTime: false } }, ch);
  assert.equal(r.body.devices[0].participant, 'P001');

  r = await j('GET', '/api/v1/device/status', null, dh);
  assert.equal(r.body.linked, true);
  assert.equal(r.body.participant, 'P001');
  assert.equal(r.body.acks.day['2026-10-20'], 1000);
  assert.equal(r.body.acks.q['2026-10-19'], undefined);
  assert.equal(r.body.config.questionHour, 8);

  // nova versão do mesmo dia volta a aparecer no pull
  const last = (await j('GET', '/api/v1/central/pull?after=0', null, ch)).body.last;
  await j('POST', '/api/v1/device/ingest', { days: [{ ...day, computedAt: 2000 }] }, dh);
  r = await j('GET', `/api/v1/central/pull?after=${last}`, null, ch);
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.items[0].version, 2000);

  // exclusão a pedido do participante: a ponte apaga tudo do aparelho e recusa novo cadastro
  r = await j('POST', '/api/v1/central/links', { links: [], forgotten: ['dev-1'] }, ch);
  assert.equal(r.body.devices.length, 0);
  r = await j('GET', '/api/v1/central/pull?after=0', null, ch);
  assert.equal(r.body.items.filter((i) => i.deviceId === 'dev-1').length, 0);
  assert.equal((await j('POST', '/api/v1/device/register', dev, { 'x-app-key': 'app-teste' })).status, 410);
  assert.equal((await j('GET', '/api/v1/device/status', null, dh)).status, 401);

  console.log('relay: todos os testes passaram');
  server.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
