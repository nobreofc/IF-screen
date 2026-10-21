// Cliente de sincronização de referência — mesma lógica de SyncManager.kt no app Android.
'use strict';

const RESEND_AFTER_MS = 6 * 3600 * 1000;

class AppClient {
  constructor({ deviceId, code, token, appKey, info }) {
    Object.assign(this, { deviceId, code, token, appKey, info });
    this.days = {}; // date -> day (com computedAt)
    this.qs = {}; // refDate -> questionário
    this.acks = { day: {}, q: {} };
    this.sent = {}; // `${canal}|${tipo}|${chave}` -> { v, at }
    this.registered = {};
    this.linked = false; this.participant = null; this.config = null;
    this.stats = { requests: 0, bytesUp: 0, ingests: 0 };
  }

  async call(base, method, path, body, extra = {}) {
    const payload = body ? JSON.stringify(body) : undefined;
    this.stats.requests++; if (payload) this.stats.bytesUp += payload.length;
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-device-id': this.deviceId, 'x-device-token': this.token, 'x-app-key': this.appKey, ...extra },
      body: payload,
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  }

  async ensureRegistered(name, base, force = false) {
    if (this.registered[name] && !force) return true;
    const r = await this.call(base, 'POST', '/api/v1/device/register', { deviceId: this.deviceId, code: this.code, token: this.token, info: this.info });
    this.registered[name] = r.status === 200;
    return this.registered[name];
  }

  mergeStatus(st) {
    for (const [k, v] of Object.entries(st.acks.day || {})) this.acks.day[k] = Math.max(this.acks.day[k] || 0, v);
    for (const [k, v] of Object.entries(st.acks.q || {})) this.acks.q[k] = Math.max(this.acks.q[k] || 0, v);
    if (st.linked) { this.linked = true; this.participant = st.participant; }
    if (st.config) this.config = st.config;
  }

  pendingFor(channel, now) {
    const fresh = (kind, key, v) => {
      const s = this.sent[`${channel}|${kind}|${key}`];
      return !(s && s.v === v && now - s.at < RESEND_AFTER_MS);
    };
    const days = Object.values(this.days).filter((d) => d.computedAt > (this.acks.day[d.date] || 0) && fresh('day', d.date, d.computedAt));
    const qs = Object.values(this.qs).filter((q) => q.answeredAt > (this.acks.q[q.refDate] || 0) && fresh('q', q.refDate, q.answeredAt));
    return { days, qs };
  }

  /** Um ciclo de sincronização. channels = [{name:'local', base}, {name:'relay', base}] em ordem de preferência. */
  async sync(channels, now, heartbeat = {}) {
    const ok = [];
    for (const ch of channels) {
      try {
        if (!(await this.ensureRegistered(ch.name, ch.base))) continue;
        let st = await this.call(ch.base, 'GET', '/api/v1/device/status');
        if (st.status === 401) { // servidor perdeu o cadastro (ex.: redeploy da ponte)
          if (!(await this.ensureRegistered(ch.name, ch.base, true))) continue;
          st = await this.call(ch.base, 'GET', '/api/v1/device/status');
        }
        if (st.status !== 200) continue;
        this.mergeStatus(st.body);
        ok.push(ch);
      } catch (_) { /* canal indisponível */ }
    }
    for (const ch of ok) {
      const { days, qs } = this.pendingFor(ch.name, now);
      try {
        const r = await this.call(ch.base, 'POST', '/api/v1/device/ingest', { days, questionnaires: qs, heartbeat: { ...heartbeat, ts: now, channel: ch.name } });
        if (r.status !== 200) continue;
        this.stats.ingests++;
        for (const d of days) this.sent[`${ch.name}|day|${d.date}`] = { v: d.computedAt, at: now };
        for (const q of qs) this.sent[`${ch.name}|q|${q.refDate}`] = { v: q.answeredAt, at: now };
        if (ch.name === 'local') { // rede local confirma na hora
          const st = await this.call(ch.base, 'GET', '/api/v1/device/status');
          if (st.status === 200) this.mergeStatus(st.body);
        }
        return ch.name; // enviado pelo canal preferido disponível
      } catch (_) { /* tenta o próximo */ }
    }
    return null;
  }
}

module.exports = { AppClient };
