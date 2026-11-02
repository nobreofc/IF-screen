// Regras de negócio da Central: cadastro/vínculo, ingestão idempotente, agregações.
'use strict';

const crypto = require('node:crypto');
const { agreement } = require('./stats');

const DEFAULTS = {
  centralName: 'Central IF Screen',
  institution: 'IFRN',
  relayEnabled: 'false',
  relayUrl: '',
  centralKey: '',
  appKey: 'ifscreen-app-key',
  pollSec: '20',
  localPort: '8787',
  questionHour: '9',
  reminderHour: '20',
  showScreenTime: 'true',
  studyDays: '7',
  relayCursor: '0',
  relayEpoch: '',
  logoFile: '',
  deletedDevices: '[]', // aparelhos cujos dados foram excluídos a pedido do participante (LGPD)
};

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function normalizeCode(raw) {
  let s = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('IFS') && s.length === 11) s = s.slice(3);
  const body = s.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (body.length !== 8 || [...body].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `IFS-${body.slice(0, 4)}-${body.slice(4)}`;
}

function localDate(d = new Date()) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

class Store {
  constructor(db, { onChange } = {}) {
    this.db = db;
    this.onChange = onChange || (() => {});
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (!this.db.get('SELECT 1 FROM settings WHERE key=?', [k])) this.db.run('INSERT INTO settings(key,value) VALUES(?,?)', [k, v]);
    }
  }

  // ------------------------------------------------------------ configurações
  settings() {
    const o = {};
    for (const r of this.db.all('SELECT key, value FROM settings')) o[r.key] = r.value;
    return o;
  }
  setting(k) { const r = this.db.get('SELECT value FROM settings WHERE key=?', [k]); return r ? r.value : DEFAULTS[k]; }
  setSettings(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (!(k in DEFAULTS)) continue;
      this.db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, String(v)]);
    }
    this.onChange('settings');
  }
  appConfig() {
    const s = this.settings();
    return {
      questionHour: Number(s.questionHour), reminderHour: Number(s.reminderHour),
      showScreenTime: s.showScreenTime === 'true', relayUrl: s.relayEnabled === 'true' ? s.relayUrl : '',
      centralName: s.centralName,
    };
  }

  log(level, msg) {
    this.db.run('INSERT INTO log(ts,level,msg) VALUES(?,?,?)', [Date.now(), level, String(msg).slice(0, 500)]);
    if (Math.random() < 0.02) this.db.run('DELETE FROM log WHERE ts < ?', [Date.now() - 30 * 86400000]);
  }

  // ------------------------------------------------------------ aparelhos
  registerDevice({ deviceId, code, tokenHash, token, info }, channel) {
    const th = tokenHash || (token ? sha256(token) : null);
    const c = normalizeCode(code);
    if (!deviceId || !c || !th) return { ok: false, error: 'dados de cadastro inválidos' };
    if (this.isDeleted(deviceId)) return { ok: false, status: 410, deleted: true, error: 'aparelho retirado do estudo (dados excluídos)' };
    const cur = this.db.get('SELECT * FROM devices WHERE device_id=?', [deviceId]);
    if (cur && cur.token_hash !== th) return { ok: false, status: 409, error: 'aparelho já cadastrado com outro token' };
    const clash = this.db.get('SELECT device_id FROM devices WHERE code=? AND device_id<>?', [c, deviceId]);
    if (clash) return { ok: false, status: 409, error: 'código em uso' };
    if (cur) {
      this.db.run('UPDATE devices SET info_json=?, last_seen=?, last_channel=? WHERE device_id=?',
        [JSON.stringify(info || {}), Date.now(), channel, deviceId]);
    } else {
      this.db.run(`INSERT INTO devices(device_id, code, token_hash, info_json, registered_at, last_seen, last_channel, linked)
        VALUES(?,?,?,?,?,?,?,0)`, [deviceId, c, th, JSON.stringify(info || {}), Date.now(), Date.now(), channel]);
      this.log('info', `Novo aparelho aguardando vínculo: ${c} (${channel})`);
      this.onChange('devices');
    }
    return { ok: true };
  }

  verifyDevice(deviceId, token) {
    const d = deviceId && this.db.get('SELECT token_hash FROM devices WHERE device_id=?', [deviceId]);
    if (!d || !token) return false;
    const a = Buffer.from(d.token_hash); const b = Buffer.from(sha256(token));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  touch(deviceId, channel) {
    this.db.run('UPDATE devices SET last_seen=?, last_channel=? WHERE device_id=?', [Date.now(), channel, deviceId]);
  }

  link(codeRaw, participantRaw) {
    const code = normalizeCode(codeRaw);
    const participant = String(participantRaw || '').trim().slice(0, 40);
    if (!code) return { ok: false, error: 'Código inválido. Formato: IFS-XXXX-XXXX' };
    if (!participant) return { ok: false, error: 'Informe a identificação do participante' };
    const d = this.db.get('SELECT * FROM devices WHERE code=?', [code]);
    if (!d) return { ok: false, notFound: true, error: 'Código ainda não recebido. Confira se o celular está conectado (rede local ou internet) e tente de novo.' };
    const dup = this.db.get('SELECT device_id FROM devices WHERE participant=? AND linked=1 AND device_id<>?', [participant, d.device_id]);
    if (dup) return { ok: false, error: `O participante ${participant} já está vinculado a outro aparelho` };
    const studyStart = addDays(localDate(), 1);
    this.db.run('UPDATE devices SET linked=1, participant=?, linked_at=?, study_start=COALESCE(study_start, ?) WHERE device_id=?',
      [participant, Date.now(), studyStart, d.device_id]);
    this.log('info', `Aparelho ${code} vinculado a ${participant}`);
    this.onChange('links');
    return { ok: true, deviceId: d.device_id };
  }

  unlink(deviceId) {
    this.db.run('UPDATE devices SET linked=0 WHERE device_id=?', [deviceId]);
    this.onChange('links');
    return { ok: true };
  }

  // ------------------------------------------------------------ exclusão (LGPD, art. 18)
  deletedIds() {
    try { const a = JSON.parse(this.setting('deletedDevices') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
  }
  isDeleted(deviceId) { return !!deviceId && this.deletedIds().includes(deviceId); }

  /**
   * Apaga todos os dados de um aparelho (tempo de tela, sessões, questionários, valores de referência e cadastro)
   * e o marca como retirado do estudo: novos envios dele são recusados e a ponte é avisada para apagar o que tiver.
   */
  deleteDevice(deviceId) {
    const d = this.db.get('SELECT code, participant FROM devices WHERE device_id=?', [deviceId]);
    if (!d) return { ok: false, error: 'aparelho não encontrado' };
    const n = {};
    this.db.tx(() => {
      for (const t of ['days', 'sessions', 'questionnaires', 'reference']) {
        n[t] = this.db.get(`SELECT COUNT(*) AS c FROM ${t} WHERE device_id=?`, [deviceId]).c;
        this.db.db.run(`DELETE FROM ${t} WHERE device_id=?`, [deviceId]);
      }
      this.db.db.run('DELETE FROM devices WHERE device_id=?', [deviceId]);
      const ids = this.deletedIds(); if (!ids.includes(deviceId)) ids.push(deviceId);
      this.db.db.run("INSERT INTO settings(key,value) VALUES('deletedDevices',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify(ids)]);
    });
    this.db.flush();
    this.log('info', `Dados do aparelho ${d.code}${d.participant ? ` (${d.participant})` : ''} excluídos a pedido do participante: ${n.days} dias, ${n.sessions} sessões, ${n.questionnaires} questionários`);
    this.onChange('links');
    this.onChange('data');
    return { ok: true, removed: n };
  }

  setStudyStart(deviceId, date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false };
    this.db.run('UPDATE devices SET study_start=? WHERE device_id=?', [date, deviceId]);
    return { ok: true };
  }

  links() {
    return this.db.all('SELECT device_id AS deviceId, linked, participant FROM devices')
      .map((r) => ({ deviceId: r.deviceId, linked: !!r.linked, participant: r.participant }));
  }

  // ------------------------------------------------------------ ingestão
  applyDay(deviceId, day, channel) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '') || !Number.isFinite(day.computedAt)) return false;
    const cur = this.db.get('SELECT version FROM days WHERE device_id=? AND date=?', [deviceId, day.date]);
    if (cur && cur.version >= day.computedAt) return false;
    const sessions = Array.isArray(day.sessions) ? day.sessions.filter((s) => Array.isArray(s) && s[1] > s[0]) : [];
    this.db.tx(() => {
      this.db.db.run(`INSERT INTO days(device_id,date,version,screen_ms,launcher_ms,own_app_ms,own_log_ms,device_off_ms,sessions_n,long_sessions,
          complete,partial_coverage,source,algo,tz,received_at,channel)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(device_id,date) DO UPDATE SET version=excluded.version, screen_ms=excluded.screen_ms, launcher_ms=excluded.launcher_ms,
          own_app_ms=excluded.own_app_ms, own_log_ms=excluded.own_log_ms, device_off_ms=excluded.device_off_ms, sessions_n=excluded.sessions_n,
          long_sessions=excluded.long_sessions, complete=excluded.complete, partial_coverage=excluded.partial_coverage, source=excluded.source,
          algo=excluded.algo, tz=excluded.tz, received_at=excluded.received_at, channel=excluded.channel`,
      [deviceId, day.date, day.computedAt, Math.round(day.screenMs || 0), Math.round(day.launcherMs || 0), Math.round(day.ownAppMs || 0),
        Number.isFinite(day.ownLogMs) ? Math.round(day.ownLogMs) : null, Math.round(day.deviceOffMs || 0), sessions.length,
        day.longSessions || 0, day.complete ? 1 : 0, day.partialCoverage ? 1 : 0, day.source || 'usagestats', day.algo || '', day.tz || '',
        Date.now(), channel]);
      this.db.db.run('DELETE FROM sessions WHERE device_id=? AND date=?', [deviceId, day.date]);
      const st = this.db.db.prepare('INSERT INTO sessions(device_id,date,start_ms,end_ms) VALUES(?,?,?,?)');
      for (const [s, e] of sessions) st.run([deviceId, day.date, Math.round(s), Math.round(e)]);
      st.free();
    });
    return true;
  }

  applyQuestionnaire(deviceId, q, channel) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.refDate || '') || !Number.isFinite(q.answeredAt)) return false;
    const cur = this.db.get('SELECT version FROM questionnaires WHERE device_id=? AND ref_date=?', [deviceId, q.refDate]);
    if (cur && cur.version >= q.answeredAt) return false;
    const clampMin = (v) => Math.max(0, Math.min(1440, Math.round(Number(v) || 0)));
    this.db.run(`INSERT INTO questionnaires(device_id,ref_date,version,tv,tv_min,pc,pc_min,answered_at,received_at,channel)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(device_id,ref_date) DO UPDATE SET version=excluded.version, tv=excluded.tv,
      tv_min=excluded.tv_min, pc=excluded.pc, pc_min=excluded.pc_min, answered_at=excluded.answered_at,
      received_at=excluded.received_at, channel=excluded.channel`,
    [deviceId, q.refDate, q.answeredAt, q.tv ? 1 : 0, q.tv ? clampMin(q.tvMin) : 0, q.pc ? 1 : 0, q.pc ? clampMin(q.pcMin) : 0, q.answeredAt, Date.now(), channel]);
    return true;
  }

  applyHeartbeat(deviceId, hb, channel) {
    this.db.run('UPDATE devices SET hb_json=?, last_seen=?, last_channel=? WHERE device_id=?',
      [JSON.stringify({ ...hb, receivedAt: Date.now(), channel }), Date.now(), channel, deviceId]);
  }

  /** Ingestão de um lote vindo do celular (rede local) ou da ponte (nuvem). */
  ingest(deviceId, body, channel) {
    let applied = 0;
    for (const d of Array.isArray(body.days) ? body.days : []) if (this.applyDay(deviceId, d, channel)) applied++;
    for (const q of Array.isArray(body.questionnaires) ? body.questionnaires : []) if (this.applyQuestionnaire(deviceId, q, channel)) applied++;
    if (body.heartbeat && typeof body.heartbeat === 'object') this.applyHeartbeat(deviceId, body.heartbeat, channel);
    else this.touch(deviceId, channel);
    if (applied) this.onChange('data');
    return applied;
  }

  status(deviceId) {
    const d = this.db.get('SELECT linked, participant FROM devices WHERE device_id=?', [deviceId]);
    const acks = { day: {}, q: {} };
    for (const r of this.db.all('SELECT date, version FROM days WHERE device_id=?', [deviceId])) acks.day[r.date] = r.version;
    for (const r of this.db.all('SELECT ref_date, version FROM questionnaires WHERE device_id=?', [deviceId])) acks.q[r.ref_date] = r.version;
    return { ok: true, channel: 'local', linked: !!(d && d.linked), participant: d ? d.participant : null, config: this.appConfig(), acks, serverTime: Date.now() };
  }

  // ------------------------------------------------------------ consultas
  deviceRow(r) {
    const info = safeJson(r.info_json); const hb = safeJson(r.hb_json);
    return {
      deviceId: r.device_id, code: r.code, participant: r.participant, linked: !!r.linked, linkedAt: r.linked_at,
      studyStart: r.study_start, registeredAt: r.registered_at, lastSeen: r.last_seen, lastChannel: r.last_channel,
      info, hb,
    };
  }

  devices() {
    return this.db.all('SELECT * FROM devices ORDER BY linked DESC, participant, registered_at').map((r) => this.deviceRow(r));
  }

  device(deviceId) {
    const r = this.db.get('SELECT * FROM devices WHERE device_id=?', [deviceId]);
    return r ? this.deviceRow(r) : null;
  }

  days(deviceId, from, to) {
    return this.db.all(`SELECT d.*, r.ref_min FROM days d LEFT JOIN reference r ON r.device_id=d.device_id AND r.date=d.date
      WHERE d.device_id=? AND d.date BETWEEN ? AND ? ORDER BY d.date`, [deviceId, from, to]).map(dayRow);
  }

  sessions(deviceId, date) {
    return this.db.all('SELECT start_ms, end_ms FROM sessions WHERE device_id=? AND date=? ORDER BY start_ms', [deviceId, date])
      .map((r) => [r.start_ms, r.end_ms]);
  }

  /** Distribuição por hora (minutos em cada hora do dia, no fuso do aparelho = fuso da Central). */
  hourly(deviceId, date) {
    const [y, m, d] = date.split('-').map(Number);
    const base = new Date(y, m - 1, d).getTime();
    const hours = new Array(24).fill(0);
    for (const [s, e] of this.sessions(deviceId, date)) {
      for (let h = 0; h < 24; h++) {
        const hs = base + h * 3600000; const he = hs + 3600000;
        const ov = Math.min(e, he) - Math.max(s, hs);
        if (ov > 0) hours[h] += ov / 60000;
      }
    }
    return hours;
  }

  questionnaires(from, to) {
    return this.db.all(`SELECT q.*, d.participant, d.code FROM questionnaires q JOIN devices d ON d.device_id=q.device_id
      WHERE q.ref_date BETWEEN ? AND ? ORDER BY q.ref_date DESC, d.participant`, [from, to]).map((r) => ({
      deviceId: r.device_id, participant: r.participant, code: r.code, refDate: r.ref_date, tv: !!r.tv, tvMin: r.tv_min,
      pc: !!r.pc, pcMin: r.pc_min, answeredAt: r.answered_at, channel: r.channel,
    }));
  }

  overview() {
    const today = localDate(); const yesterday = addDays(today, -1); const from = addDays(today, -13);
    const devs = this.devices().filter((d) => d.linked);
    const now = Date.now();
    const rows = devs.map((d) => {
      const days = this.days(d.deviceId, from, today);
      const byDate = Object.fromEntries(days.map((x) => [x.date, x]));
      const last7 = []; for (let i = 6; i >= 0; i--) { const dt = addDays(today, -i); last7.push(byDate[dt] ? byDate[dt].screenMin : null); }
      const complete7 = days.filter((x) => x.complete && x.date >= addDays(today, -7) && x.date < today);
      const q = this.db.get('SELECT 1 FROM questionnaires WHERE device_id=? AND ref_date=?', [d.deviceId, yesterday]);
      return {
        ...d,
        today: byDate[today] ? byDate[today].screenMin : null,
        yesterday: byDate[yesterday] ? byDate[yesterday].screenMin : null,
        mean7: complete7.length ? complete7.reduce((s, x) => s + x.screenMin, 0) / complete7.length : null,
        last7, answeredYesterday: !!q, alerts: alertsFor(d, now),
      };
    });
    const dailyMeans = [];
    for (let i = 13; i >= 0; i--) {
      const dt = addDays(today, -i);
      const r = this.db.get(`SELECT AVG(screen_ms) AS m, COUNT(*) AS n FROM days d JOIN devices v ON v.device_id=d.device_id
        WHERE v.linked=1 AND d.date=?`, [dt]);
      dailyMeans.push({ date: dt, meanMin: r && r.n ? r.m / 60000 : null, n: r ? r.n : 0 });
    }
    const pending = this.devices().filter((d) => !d.linked).length;
    return {
      today, yesterday, rows, dailyMeans, pending,
      kpis: {
        linked: devs.length,
        active24h: devs.filter((d) => d.lastSeen && now - d.lastSeen < 86400000).length,
        meanDaily: avg(rows.map((r) => r.mean7).filter((v) => v !== null)),
        answeredYesterday: rows.filter((r) => r.answeredYesterday).length,
      },
    };
  }

  // ------------------------------------------------------------ validação (padrão-ouro)
  setReference(deviceId, date, minutes, note) {
    if (minutes === null || minutes === '' || minutes === undefined) {
      this.db.run('DELETE FROM reference WHERE device_id=? AND date=?', [deviceId, date]);
    } else {
      const v = Number(minutes);
      if (!Number.isFinite(v) || v < 0 || v > 1440) return { ok: false, error: 'valor inválido' };
      this.db.run(`INSERT INTO reference(device_id,date,ref_min,note,entered_at) VALUES(?,?,?,?,?)
        ON CONFLICT(device_id,date) DO UPDATE SET ref_min=excluded.ref_min, note=excluded.note, entered_at=excluded.entered_at`,
      [deviceId, date, v, note || null, Date.now()]);
    }
    return { ok: true };
  }

  validation({ excludeLauncher = false } = {}) {
    const rows = this.db.all(`SELECT d.device_id, v.participant, v.code, d.date, d.screen_ms, d.launcher_ms, d.complete, r.ref_min, r.note
      FROM reference r JOIN days d ON d.device_id=r.device_id AND d.date=r.date
      JOIN devices v ON v.device_id=d.device_id ORDER BY v.participant, d.date`);
    const pairs = rows.map((r) => {
      // X truncado ao minuto, como o Bem-estar Digital exibe (comparação justa)
      const x = Math.floor((r.screen_ms - (excludeLauncher ? r.launcher_ms : 0)) / 60000);
      return {
        deviceId: r.device_id, subject: r.participant || r.code, code: r.code, date: r.date,
        x, y: r.ref_min, diff: x - r.ref_min, complete: !!r.complete, note: r.note, launcherMin: r.launcher_ms / 60000,
      };
    });
    return { pairs, stats: agreement(pairs.filter((p) => p.complete)), statsAll: agreement(pairs) };
  }
}

function dayRow(r) {
  return {
    date: r.date, version: r.version, screenMs: r.screen_ms, screenMin: r.screen_ms / 60000,
    launcherMin: r.launcher_ms / 60000, ownAppMin: r.own_app_ms / 60000,
    ownLogMin: r.own_log_ms === null || r.own_log_ms === undefined ? null : r.own_log_ms / 60000,
    deviceOffMin: r.device_off_ms / 60000, sessionsN: r.sessions_n, longSessions: r.long_sessions,
    complete: !!r.complete, partialCoverage: !!r.partial_coverage, source: r.source, algo: r.algo,
    receivedAt: r.received_at, channel: r.channel, refMin: r.ref_min === undefined ? null : r.ref_min,
  };
}

function alertsFor(d, now) {
  const a = [];
  const hb = d.hb || {};
  if (!d.lastSeen || now - d.lastSeen > 3 * 3600000) a.push({ level: 'warn', text: 'Sem contato há mais de 3 h' });
  if (hb.usageAccess === false) a.push({ level: 'error', text: 'Acesso ao uso desativado' });
  if (hb.notifPerm === false) a.push({ level: 'warn', text: 'Notificações bloqueadas' });
  if (hb.batteryOptIgnored === false) a.push({ level: 'warn', text: 'Otimização de bateria ativa' });
  if (hb.autoTime === false) a.push({ level: 'warn', text: 'Data/hora manual' });
  return a;
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
function safeJson(s) { try { return s ? JSON.parse(s) : {}; } catch { return {}; } }

module.exports = { Store, normalizeCode, localDate, addDays, sha256, DEFAULTS };
