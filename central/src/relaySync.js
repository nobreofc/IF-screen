// Sincronização Central ⇄ servidor-ponte (Railway).
'use strict';

class RelaySync {
  constructor(store, { onLog = () => {}, onStatus = () => {} } = {}) {
    this.store = store;
    this.onLog = onLog;
    this.onStatus = onStatus;
    this.timer = null;
    this.busy = false;
    this.lastLinksPush = 0;
    this.linksDirty = true;
    this.state = { ok: null, lastPull: null, lastError: null, devicesOnRelay: 0, pulledTotal: 0 };
  }

  cfg() {
    const s = this.store.settings();
    return { enabled: s.relayEnabled === 'true', url: (s.relayUrl || '').replace(/\/+$/, ''), key: s.centralKey, pollSec: Math.max(5, Number(s.pollSec) || 20) };
  }

  async req(method, p, body) {
    const { url, key } = this.cfg();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(url + p, {
        method, signal: ctrl.signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      return j;
    } finally { clearTimeout(t); }
  }

  start() {
    this.stop();
    const loop = async () => {
      await this.tick();
      this.timer = setTimeout(loop, this.cfg().pollSec * 1000);
    };
    this.timer = setTimeout(loop, 1000);
  }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  markLinksDirty() { this.linksDirty = true; }

  async test() {
    const { url } = this.cfg();
    if (!url) return { ok: false, error: 'Informe o endereço do Railway' };
    try {
      const h = await fetch(url + '/health').then((r) => r.json());
      await this.req('POST', '/api/v1/central/links', { links: [] });
      return { ok: true, health: h };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async tick() {
    const c = this.cfg();
    if (!c.enabled || !c.url || !c.key || this.busy) return;
    this.busy = true;
    try {
      // 1) vínculos + configuração (a ponte é reconstruída a partir da Central)
      if (this.linksDirty || Date.now() - this.lastLinksPush > 5 * 60000) {
        const r = await this.req('POST', '/api/v1/central/links', { links: this.store.links(), config: this.store.appConfig() });
        this.state.devicesOnRelay = (r.devices || []).length;
        this.lastLinksPush = Date.now(); this.linksDirty = false;
      }
      // 2) puxar novidades em páginas
      let after = Number(this.store.setting('relayCursor')) || 0;
      if (this.needFullPull && Date.now() - (this.lastFullPull || 0) > 10 * 60000) {
        // havia dados de aparelho cujo cadastro ainda não tinha chegado: relê tudo (idempotente)
        after = 0; this.needFullPull = false; this.lastFullPull = Date.now();
      }
      for (let page = 0; page < 20; page++) {
        const r = await this.req('GET', `/api/v1/central/pull?after=${after}&limit=500`);
        const epoch = this.store.setting('relayEpoch');
        if (r.epoch && r.epoch !== epoch) {
          // ponte nova ou reiniciada sem estado: recomeça a leitura do zero (idempotente)
          this.store.setSettings({ relayEpoch: r.epoch, relayCursor: 0 });
          this.linksDirty = true;
          if (after !== 0) { after = 0; page--; continue; }
        }
        const acks = []; let applied = 0;
        for (const it of r.items || []) {
          if (it.kind === 'register') {
            const res = this.store.registerDevice(it.payload, 'nuvem');
            if (!res.ok) this.onLog('warn', `cadastro rejeitado (${it.deviceId}): ${res.error}`);
            continue;
          }
          if (!this.store.device(it.deviceId)) { this.needFullPull = true; continue; } // cadastro ainda não chegou
          if (it.kind === 'day') { if (this.store.applyDay(it.deviceId, it.payload, 'nuvem')) applied++; }
          else if (it.kind === 'q') { if (this.store.applyQuestionnaire(it.deviceId, it.payload, 'nuvem')) applied++; }
          else if (it.kind === 'hb') { this.store.applyHeartbeat(it.deviceId, it.payload, 'nuvem'); continue; }
          if (it.kind === 'day' || it.kind === 'q') acks.push({ deviceId: it.deviceId, kind: it.kind, key: it.key, version: it.version });
        }
        // o ack só é enviado depois de gravar no banco da Central (garantia ponta a ponta)
        if (acks.length) { this.store.db.flush(); await this.req('POST', '/api/v1/central/ack', { acks }); }
        after = r.last;
        this.store.setSettings({ relayCursor: after });
        this.state.pulledTotal += (r.items || []).length;
        if (applied) this.store.onChange('data');
        if (!r.more) break;
      }
      this.state.ok = true; this.state.lastPull = Date.now(); this.state.lastError = null;
    } catch (e) {
      this.state.ok = false; this.state.lastError = e.message;
      this.onLog('warn', `nuvem: ${e.message}`);
    } finally {
      this.busy = false;
      this.onStatus(this.state);
    }
  }
}

module.exports = { RelaySync };
