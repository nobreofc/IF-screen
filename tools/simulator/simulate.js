/*
 * Teste ponta a ponta: 100 aparelhos × 7 dias completos (+ dia em andamento).
 *   eventos brutos → algoritmo (igual ao app) → sincronização (rede local / ponte Railway)
 *   → Central (banco) → comparação com a "verdade" gerada.
 * Uso: node simulate.js [saida.db]
 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

const N_DEVICES = Number(process.env.N_DEVICES || 100);
const TZ_OFFSET_MS = -3 * 3600000; // America/Fortaleza
const STUDY_DAYS = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
const dayStart = (date) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d) - TZ_OFFSET_MS; };
const T0 = dayStart('2026-10-12'); // instalação na véspera, ao meio-dia
const INSTALL = T0 + 12 * 3600000;
const NOW_END = dayStart('2026-10-20') + 15 * 3600000; // 20/10 às 15:00
const CYCLE_MS = 3 * 3600000; // ciclo de sincronização simulado (o app real usa 15 min)
const dateOf = (t) => new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10);

const ROOT = path.join(__dirname, '..', '..');
const { generateDevice, rng } = require('./generator');
const { extractIntervals, summarizeDay, clip, sum } = require('../algorithm/screentime');
const { AppClient } = require('./appClient');

async function main() {
  const t0 = Date.now();
  const out = process.argv[2] || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ifs-')), 'sim.db');
  if (fs.existsSync(out)) fs.unlinkSync(out);

  // ---------- servidor-ponte (como no Railway)
  process.env.PORT = '0'; process.env.RATE_LIMIT_PER_MIN = '1000000'; process.env.CENTRAL_KEY = 'sim-central-key'; process.env.APP_KEY = 'ifscreen-app-key';
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-'));
  const relay = require(path.join(ROOT, 'relay', 'server.js'));
  await new Promise((r) => (relay.server.listening ? r() : relay.server.on('listening', r)));
  const relayBase = `http://127.0.0.1:${relay.server.address().port}`;

  // ---------- Central (mesmos módulos do .exe, sem a janela)
  const { Database } = require(path.join(ROOT, 'central', 'src', 'db'));
  const { Store } = require(path.join(ROOT, 'central', 'src', 'store'));
  const { createLocalServer } = require(path.join(ROOT, 'central', 'src', 'localServer'));
  const { RelaySync } = require(path.join(ROOT, 'central', 'src', 'relaySync'));
  const db = await Database.open(out);
  const store = new Store(db);
  store.setSettings({ relayEnabled: true, relayUrl: relayBase, centralKey: 'sim-central-key', localPort: 0, showScreenTime: 'false' });
  const local = createLocalServer(store, { port: 0 });
  const localPort = await local.start();
  const localBase = `http://127.0.0.1:${localPort}`;
  const rsync = new RelaySync(store, { onLog: () => {} });

  // ---------- aparelhos
  const R = rng(2026);
  const MODELS = [['samsung', 'Galaxy A15', '14'], ['samsung', 'Galaxy A54', '15'], ['motorola', 'moto g54', '14'], ['Xiaomi', 'Redmi Note 13', '14'],
    ['motorola', 'moto e22', '12'], ['samsung', 'Galaxy S23', '16'], ['Xiaomi', 'POCO X6', '15'], ['realme', 'C55', '13'], ['Google', 'Pixel 8a', '16']];
  const devices = [];
  for (let i = 0; i < N_DEVICES; i++) {
    const gen = generateDevice(1000 + i, T0, NOW_END);
    const m = MODELS[i % MODELS.length];
    const code = 'IFS-' + crypto.randomBytes(5).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().replace(/[ILOU]/g, '7').padEnd(8, '9').slice(0, 4) + '-' +
      crypto.randomBytes(5).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().replace(/[ILOU]/g, '8').padEnd(8, '9').slice(0, 4);
    // perfil de conectividade: 40 só rede local, 45 só nuvem, 15 alternam
    const mode = i < 40 ? 'local' : i < 85 ? 'relay' : 'both';
    const client = new AppClient({
      deviceId: crypto.randomUUID(), code, token: crypto.randomBytes(24).toString('hex'), appKey: 'ifscreen-app-key',
      info: { manufacturer: m[0], model: m[1], androidVersion: m[2], sdk: 30 + (i % 7), appVersion: '1.0.0' },
    });
    devices.push({ i, gen, client, mode, participant: `P${String(i + 1).padStart(3, '0')}`, answered: {}, offlineDay: R() < 0.1 ? STUDY_DAYS[Math.floor(R() * 7)] : null });
  }

  const recompute = (dev, now) => {
    const evs = dev.gen.events.filter((e) => e.t < now);
    const iv = extractIntervals(evs, { nowMs: now, usesKeyguard: dev.gen.usesKeyguard, launchers: new Set(['com.android.launcher3']), ownPkg: 'br.edu.ifrn.ifscreen' });
    for (let ds = dayStart(dateOf(INSTALL)); ds <= now; ds += 86400000) {
      const date = dateOf(ds);
      const prev = dev.client.days[date];
      if (prev && prev.complete) continue; // dia fechado: congelado
      const d = summarizeDay(iv, date, ds, ds + 86400000, now, T0 - 86400000, { tz: 'America/Fortaleza', source: 'usagestats' });
      if (prev && prev.screenMs === d.screenMs && prev.complete === d.complete && prev.sessions.length === d.sessions.length) continue;
      dev.client.days[date] = { ...d, computedAt: now };
    }
  };

  let cycles = 0; let relayWiped = false; let linkedAt = null; const linkLatency = [];
  for (let now = INSTALL + CYCLE_MS; now <= NOW_END; now += CYCLE_MS) {
    cycles++;
    const hourLocal = new Date(now + TZ_OFFSET_MS).getUTCHours();
    const today = dateOf(now); const yesterday = dateOf(now - 86400000);
    // falha injetada: redeploy da ponte sem volume (estado perdido) no 3º dia
    if (!relayWiped && now >= dayStart('2026-10-15') + 12 * 3600000) {
      relay.resetState(); relayWiped = true;
    }
    await Promise.all(devices.map(async (dev) => {
      recompute(dev, now);
      if (hourLocal >= 9 && !dev.answered[yesterday] && yesterday >= STUDY_DAYS[0] && R() < 0.92) {
        const tv = R() < 0.7; const pc = R() < 0.6;
        dev.client.qs[yesterday] = { refDate: yesterday, tv, tvMin: tv ? Math.round(30 + R() * 210) : 0, pc, pcMin: pc ? Math.round(20 + R() * 400) : 0, answeredAt: now };
        dev.answered[yesterday] = true;
      }
      if (dev.offlineDay === today) return; // sem internet e fora da escola o dia todo
      const ch = [];
      const atSchool = hourLocal >= 7 && hourLocal < 17 && new Date(now + TZ_OFFSET_MS).getUTCDay() % 6 !== 0;
      if (dev.mode === 'local' || (dev.mode === 'both' && atSchool)) ch.push({ name: 'local', base: localBase });
      if (dev.mode === 'relay' || dev.mode === 'both') ch.push({ name: 'relay', base: relayBase });
      await dev.client.sync(ch, now, { appVersion: '1.0.0', usageAccess: true, serviceRunning: true, batteryOptIgnored: dev.i % 17 !== 0, notifPerm: true, autoTime: true, usesKeyguard: dev.gen.usesKeyguard, tz: 'America/Fortaleza', battery: 20 + Math.round(R() * 80) });
    }));
    await rsync.tick();
    // o pesquisador vincula os aparelhos no primeiro ciclo em que o código aparece na Central
    if (cycles === 1 || !linkedAt) {
      let n = 0;
      for (const dev of devices) {
        if (dev.linked) continue;
        const r = store.link(dev.client.code, dev.participant);
        if (r.ok) { dev.linked = true; n++; linkLatency.push(cycles); }
      }
      if (devices.every((d) => d.linked)) linkedAt = cycles;
      rsync.markLinksDirty();
      await rsync.tick();
    }
  }
  // ciclo final: todos com conexão (fim do estudo, recolhimento)
  for (let k = 0; k < 3; k++) {
    await Promise.all(devices.map(async (dev) => {
      recompute(dev, NOW_END);
      const ch = dev.mode === 'relay' ? [{ name: 'relay', base: relayBase }] : [{ name: 'local', base: localBase }];
      await dev.client.sync(ch, NOW_END + k * 7 * 3600000);
    }));
    await rsync.tick();
  }
  db.flush();

  // ---------- verificação contra a verdade
  let checked = 0; let exact = 0; let maxAbsMs = 0; let sessionMismatch = 0; let missing = 0; let notComplete = 0;
  const perDay = [];
  for (const dev of devices) {
    for (const date of STUDY_DAYS) {
      const ds = dayStart(date);
      const truthMs = sum(clip(dev.gen.truth, ds, ds + 86400000));
      const truthN = clip(dev.gen.truth, ds, ds + 86400000).length;
      const row = db.get('SELECT screen_ms, sessions_n, complete FROM days WHERE device_id=? AND date=?', [dev.client.deviceId, date]);
      checked++;
      if (!row) { missing++; continue; }
      if (!row.complete) notComplete++;
      const diff = Math.abs(row.screen_ms - truthMs);
      maxAbsMs = Math.max(maxAbsMs, diff);
      if (diff === 0) exact++;
      if (row.sessions_n !== truthN) sessionMismatch++;
      perDay.push(truthMs / 60000);
    }
  }
  const qExpected = devices.reduce((s, d) => s + Object.keys(d.client.qs).length, 0);
  const qGot = db.get('SELECT COUNT(*) AS n FROM questionnaires').n;
  const linked = db.get('SELECT COUNT(*) AS n FROM devices WHERE linked=1').n;
  const notifDiscarded = devices.reduce((s, d) => s + d.gen.events.filter((e) => e.type === 15).length, 0) - devices.reduce((s, d) => s + d.gen.truth.length, 0);
  const totalReq = devices.reduce((s, d) => s + d.client.stats.requests, 0);
  const totalUp = devices.reduce((s, d) => s + d.client.stats.bytesUp, 0);
  const viaLocal = db.get("SELECT COUNT(*) AS n FROM days WHERE channel='local'").n;
  const viaRelay = db.get("SELECT COUNT(*) AS n FROM days WHERE channel='nuvem'").n;
  const mean = perDay.reduce((s, x) => s + x, 0) / perDay.length;
  const longS = db.get('SELECT SUM(long_sessions) AS n FROM days').n;
  const summary = {
    devices: N_DEVICES, studyDays: STUDY_DAYS.length, deviceDaysChecked: checked, exactMatches: exact, maxAbsDiffMs: maxAbsMs,
    sessionCountMismatches: sessionMismatch, missingDays: missing, daysNotMarkedComplete: notComplete,
    questionnairesExpected: qExpected, questionnairesReceived: qGot, devicesLinked: linked, firstCycleAllLinked: linkedAt,
    syncCyclesSimulated: cycles, relayWipedMidStudy: relayWiped, rawEvents: devices.reduce((s, d) => s + d.gen.events.length, 0),
    screenOnWithoutUnlockDiscarded: notifDiscarded, longSessionsFlagged: longS,
    meanScreenTimeMinPerDay: Math.round(mean * 10) / 10, deviceDaysByLastChannel: { local: viaLocal, nuvem: viaRelay },
    httpRequestsFromDevices: totalReq, uploadMB: Math.round(totalUp / 1048576 * 100) / 100,
    centralDbMB: Math.round(fs.statSync(out).size / 1048576 * 100) / 100, wallSeconds: Math.round((Date.now() - t0) / 100) / 10, dbFile: out,
  };
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(__dirname, 'resultado-simulacao.json'), JSON.stringify(summary, null, 2));
  const pass = exact === checked && missing === 0 && notComplete === 0 && qGot === qExpected && linked === N_DEVICES && sessionMismatch === 0;
  console.log(pass ? '\nRESULTADO: APROVADO — Central idêntica à verdade em todos os aparelho-dias' : '\nRESULTADO: REPROVADO');
  await local.stop(); relay.server.close();
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
