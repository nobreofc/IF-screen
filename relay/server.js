/*
 * IF Screen — Servidor-ponte (Railway)
 * ------------------------------------------------------------
 * Função: "caixa postal" entre os celulares (fora da rede da Central)
 * e a Central Windows. Store-and-forward com confirmação ponta a ponta:
 *   celular --ingest--> ponte <--pull/ack-- Central
 * O celular só considera um dado entregue quando a CENTRAL confirma (ack),
 * então a perda do estado da ponte (redeploy) nunca perde dados: o
 * celular reenvia e a Central reaplica os vínculos.
 *
 * Zero dependências: roda com `node server.js` (Node >= 18).
 * Variáveis de ambiente:
 *   PORT         porta HTTP (o Railway define sozinho)
 *   CENTRAL_KEY  chave secreta usada pela Central (obrigatória em produção)
 *   APP_KEY      chave embutida no app Android (protege o cadastro)
 *   DATA_DIR     pasta para persistir estado (opcional; use um Volume)
 */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8080);
const CENTRAL_KEY = process.env.CENTRAL_KEY || 'troque-esta-chave-central';
const APP_KEY = process.env.APP_KEY || 'ifscreen-app-key';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'relay-state.json');
const MAX_BODY = 2 * 1024 * 1024; // 2 MB
const VERSION = '1.1.0';
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 600); // por IP (escolas usam NAT: vários celulares, um IP)

// ---------------------------------------------------------------- estado
const state = {
  seq: 0,
  devices: {}, // deviceId -> { deviceId, code, tokenHash, info, registeredAt, lastSeen, linked, participant }
  items: {}, // "deviceId|kind|key" -> { seq, deviceId, kind, key, version, payload, updatedAt, ackedVersion }
  config: { questionHour: 9, reminderHour: 20, showScreenTime: true, updatedAt: 0 },
  forgotten: [], // aparelhos retirados do estudo (dados excluídos na Central): cadastro recusado
  centralLastSeen: 0,
  startedAt: Date.now(),
  epoch: crypto.randomBytes(8).toString('hex'), // muda quando o estado é perdido; a Central então relê tudo
};
function resetState() {
  Object.assign(state, { seq: 0, devices: {}, items: {}, epoch: crypto.randomBytes(8).toString('hex') });
  dirty = true;
}
let dirty = false;

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const s = JSON.parse(raw);
    Object.assign(state, s, { startedAt: Date.now() });
    log('estado carregado', Object.keys(state.devices).length, 'aparelhos');
  } catch (_) {
    log('iniciando com estado vazio');
  }
}
function saveState() {
  if (!dirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STATE_FILE);
    dirty = false;
  } catch (e) {
    log('falha ao salvar estado:', e.message);
  }
}
setInterval(saveState, 10_000).unref();
setInterval(purge, 60 * 60 * 1000).unref();

// Remove o conteúdo de itens já confirmados pela Central há mais de 2 dias,
// mantendo só a versão confirmada (necessária para o status do celular).
function purge() {
  const limit = Date.now() - 2 * 24 * 3600 * 1000;
  let n = 0;
  for (const it of Object.values(state.items)) {
    if (it.payload && it.ackedVersion >= it.version && it.updatedAt < limit) {
      it.payload = null;
      n++;
    }
  }
  if (n) { dirty = true; log('purga:', n, 'itens'); }
}

// ---------------------------------------------------------------- util
function log(...a) { console.log(new Date().toISOString(), ...a); }
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function safeEq(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('corpo muito grande'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// limite simples por IP
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.t > 60_000) { b = { t: now, n: 0 }; buckets.set(ip, b); }
  b.n++;
  return b.n > RATE_LIMIT;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 120_000) buckets.delete(k); }, 60_000).unref();

const CODE_RE = /^IFS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function upsertItem(deviceId, kind, key, version, payload) {
  const id = `${deviceId}|${kind}|${key}`;
  const cur = state.items[id];
  if (cur && cur.version >= version) return false; // já temos igual ou mais novo
  state.items[id] = {
    seq: ++state.seq, deviceId, kind, key, version, payload,
    updatedAt: Date.now(), ackedVersion: cur ? cur.ackedVersion : 0,
  };
  dirty = true;
  return true;
}

function authDevice(req) {
  const id = req.headers['x-device-id'];
  const token = req.headers['x-device-token'];
  const d = id && state.devices[id];
  if (!d || !token || !safeEq(d.tokenHash, sha256(token))) return null;
  return d;
}
function authCentral(req) {
  const h = req.headers.authorization || '';
  const k = h.startsWith('Bearer ') ? h.slice(7) : '';
  return k && safeEq(k, CENTRAL_KEY);
}

// ---------------------------------------------------------------- rotas
const routes = {
  'GET /': async (req, res) => send(res, 200, { service: 'IF Screen relay', version: VERSION }),
  'GET /health': async (req, res) => send(res, 200, {
    ok: true, version: VERSION, uptimeSec: Math.round((Date.now() - state.startedAt) / 1000),
    devices: Object.keys(state.devices).length, items: Object.keys(state.items).length,
    centralLastSeen: state.centralLastSeen,
  }),

  // ---------- aparelho
  'POST /api/v1/device/register': async (req, res) => {
    if (!safeEq(req.headers['x-app-key'] || '', APP_KEY)) return send(res, 401, { error: 'app_key inválida' });
    const b = await readBody(req);
    const { deviceId, code, token, info } = b;
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) return send(res, 400, { error: 'deviceId' });
    if (!CODE_RE.test(code || '')) return send(res, 400, { error: 'código inválido' });
    if (!token || String(token).length < 16) return send(res, 400, { error: 'token' });
    if ((state.forgotten || []).includes(deviceId)) return send(res, 410, { error: 'aparelho retirado do estudo' });
    const tokenHash = sha256(token);
    const existing = state.devices[deviceId];
    if (existing && !safeEq(existing.tokenHash, tokenHash)) return send(res, 409, { error: 'aparelho já cadastrado com outro token' });
    const clash = Object.values(state.devices).find((d) => d.code === code && d.deviceId !== deviceId);
    if (clash) return send(res, 409, { error: 'código em uso' });
    state.devices[deviceId] = {
      deviceId, code, tokenHash, info: info || {},
      registeredAt: existing ? existing.registeredAt : Date.now(),
      lastSeen: Date.now(),
      linked: existing ? existing.linked : false,
      participant: existing ? existing.participant : null,
    };
    upsertItem(deviceId, 'register', 'reg', Date.now(), { deviceId, code, tokenHash, info: info || {} });
    dirty = true;
    send(res, 200, { ok: true, linked: state.devices[deviceId].linked });
  },

  'POST /api/v1/device/ingest': async (req, res) => {
    const d = authDevice(req);
    if (!d) return send(res, 401, { error: 'não autorizado' });
    const b = await readBody(req);
    let accepted = 0;
    for (const day of Array.isArray(b.days) ? b.days.slice(0, 120) : []) {
      if (!DATE_RE.test(day.date || '') || !Number.isFinite(day.computedAt)) continue;
      if (upsertItem(d.deviceId, 'day', day.date, day.computedAt, day)) accepted++;
    }
    for (const q of Array.isArray(b.questionnaires) ? b.questionnaires.slice(0, 120) : []) {
      if (!DATE_RE.test(q.refDate || '') || !Number.isFinite(q.answeredAt)) continue;
      if (upsertItem(d.deviceId, 'q', q.refDate, q.answeredAt, q)) accepted++;
    }
    if (b.heartbeat && typeof b.heartbeat === 'object') {
      upsertItem(d.deviceId, 'hb', 'hb', Date.now(), b.heartbeat);
    }
    d.lastSeen = Date.now();
    dirty = true;
    send(res, 200, { ok: true, accepted });
  },

  'GET /api/v1/device/status': async (req, res) => {
    const d = authDevice(req);
    if (!d) return send(res, 401, { error: 'não autorizado' });
    d.lastSeen = Date.now();
    const acks = { day: {}, q: {} };
    for (const it of Object.values(state.items)) {
      if (it.deviceId !== d.deviceId || !it.ackedVersion) continue;
      if (it.kind === 'day') acks.day[it.key] = it.ackedVersion;
      if (it.kind === 'q') acks.q[it.key] = it.ackedVersion;
    }
    send(res, 200, {
      ok: true, channel: 'relay', linked: !!d.linked, participant: d.participant,
      config: state.config, acks, centralLastSeen: state.centralLastSeen, serverTime: Date.now(),
    });
  },

  // ---------- central
  'GET /api/v1/central/pull': async (req, res, url) => {
    if (!authCentral(req)) return send(res, 401, { error: 'não autorizado' });
    state.centralLastSeen = Date.now();
    const after = Number(url.searchParams.get('after') || 0);
    const limit = Math.min(1000, Number(url.searchParams.get('limit') || 500));
    const list = Object.values(state.items)
      .filter((it) => it.seq > after && it.payload)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map(({ seq, deviceId, kind, key, version, payload }) => ({ seq, deviceId, kind, key, version, payload }));
    const last = list.length ? list[list.length - 1].seq : after;
    send(res, 200, { ok: true, items: list, last, more: list.length === limit, serverSeq: state.seq, epoch: state.epoch });
  },

  'POST /api/v1/central/ack': async (req, res) => {
    if (!authCentral(req)) return send(res, 401, { error: 'não autorizado' });
    const b = await readBody(req);
    let n = 0;
    for (const a of Array.isArray(b.acks) ? b.acks : []) {
      const it = state.items[`${a.deviceId}|${a.kind}|${a.key}`];
      if (it && Number(a.version) > (it.ackedVersion || 0)) { it.ackedVersion = Number(a.version); n++; }
      else if (!it && (a.kind === 'day' || a.kind === 'q')) {
        // Central já tinha o dado (veio pela rede local): registra o ack mesmo assim
        state.items[`${a.deviceId}|${a.kind}|${a.key}`] = {
          seq: ++state.seq, deviceId: a.deviceId, kind: a.kind, key: a.key,
          version: Number(a.version), payload: null, updatedAt: Date.now(), ackedVersion: Number(a.version),
        };
        n++;
      }
    }
    if (n) dirty = true;
    send(res, 200, { ok: true, acked: n });
  },

  // Central reaplica a lista de vínculos (idempotente); devolve aparelhos conhecidos
  'POST /api/v1/central/links': async (req, res) => {
    if (!authCentral(req)) return send(res, 401, { error: 'não autorizado' });
    const b = await readBody(req);
    for (const l of Array.isArray(b.links) ? b.links : []) {
      const d = state.devices[l.deviceId];
      if (d) { d.linked = !!l.linked; d.participant = l.participant || null; }
    }
    // LGPD: aparelhos cujos dados a Central excluiu — apaga cadastro e tudo o que estiver guardado aqui
    if (Array.isArray(b.forgotten)) {
      const set = new Set(state.forgotten || []);
      for (const id of b.forgotten.slice(0, 10000)) {
        if (typeof id !== 'string' || id.length > 64) continue;
        set.add(id);
        delete state.devices[id];
        for (const k of Object.keys(state.items)) if (state.items[k].deviceId === id) delete state.items[k];
      }
      state.forgotten = [...set];
    }
    if (b.config && typeof b.config === 'object') {
      const c = b.config;
      state.config = {
        questionHour: clampInt(c.questionHour, 0, 23, 9),
        reminderHour: clampInt(c.reminderHour, 0, 23, 20),
        showScreenTime: !!c.showScreenTime,
        updatedAt: Date.now(),
      };
    }
    dirty = true;
    send(res, 200, {
      ok: true,
      devices: Object.values(state.devices).map(({ deviceId, code, info, registeredAt, lastSeen, linked, participant }) =>
        ({ deviceId, code, info, registeredAt, lastSeen, linked, participant })),
    });
  },
};

function clampInt(v, lo, hi, def) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
}

const server = http.createServer(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return send(res, 429, { error: 'muitas requisições' });
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { error: 'url' }); }
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: 'rota não encontrada' });
  try { await handler(req, res, url); }
  catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'erro interno' });
    if (!e.status) log('erro', e);
  }
});

loadState();
server.listen(PORT, () => {
  log(`IF Screen relay ${VERSION} ouvindo na porta ${PORT}`);
  if (CENTRAL_KEY === 'troque-esta-chave-central') log('AVISO: defina CENTRAL_KEY nas variáveis do Railway');
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { dirty = true; saveState(); process.exit(0); });
}

module.exports = { server, state, resetState };
