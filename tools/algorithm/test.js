// Testes do algoritmo de referência: node test.js
'use strict';
const assert = require('node:assert');
const { EV, extractIntervals, summarizeDay } = require('./screentime');

const M = 60_000; const H = 60 * M;
const D0 = Date.UTC(2026, 9, 20, 3, 0, 0); // 20/10/2026 00:00 em Fortaleza (UTC-3)
const opt = (o = {}) => ({ nowMs: D0 + 30 * H, usesKeyguard: true, launchers: new Set(['launcher']), ownPkg: 'br.edu.ifrn.ifscreen', ...o });
const day = (iv, now = D0 + 30 * H) => summarizeDay(iv, '2026-10-20', D0, D0 + 24 * H, now, D0 - 24 * H);
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('desbloqueio → tela apagada conta exatamente', () => {
  const ev = [
    { t: D0 + 8 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 8 * H + 5000, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 8 * H + 20 * M, type: EV.SCREEN_NON_INTERACTIVE },
    { t: D0 + 8 * H + 20 * M + 10, type: EV.KEYGUARD_SHOWN },
  ];
  const d = day(extractIntervals(ev, opt()));
  assert.equal(d.screenMs, 20 * M - 5000); // tempo do PIN (5 s) descartado
});

t('notificação acende a tela sem desbloqueio → 0', () => {
  const ev = [
    { t: D0 + 9 * H, type: EV.KEYGUARD_SHOWN },
    { t: D0 + 10 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 10 * H + 8000, type: EV.SCREEN_NON_INTERACTIVE },
  ];
  assert.equal(day(extractIntervals(ev, opt())).screenMs, 0);
});

t('ligação/música com tela apagada não conta', () => {
  const ev = [
    { t: D0 + 11 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 11 * H + 1000, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 11 * H + 2 * M, type: EV.SCREEN_NON_INTERACTIVE }, // sensor de proximidade apaga
    { t: D0 + 11 * H + 40 * M, type: EV.SCREEN_INTERACTIVE }, // reacende sem bloqueio (atraso de bloqueio)
    { t: D0 + 11 * H + 41 * M, type: EV.SCREEN_NON_INTERACTIVE },
    { t: D0 + 11 * H + 41 * M + 5, type: EV.KEYGUARD_SHOWN },
  ];
  assert.equal(day(extractIntervals(ev, opt())).screenMs, 2 * M - 1000 + 1 * M);
});

t('aparelho sem bloqueio: conta da tela ligada', () => {
  const ev = [
    { t: D0 + 12 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 12 * H + 30 * M, type: EV.SCREEN_NON_INTERACTIVE },
  ];
  assert.equal(day(extractIntervals(ev, opt({ usesKeyguard: false }))).screenMs, 30 * M);
});

t('sessão atravessando a meia-noite é dividida', () => {
  const ev = [
    { t: D0 - 10 * M, type: EV.SCREEN_INTERACTIVE },
    { t: D0 - 10 * M + 1, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 15 * M, type: EV.SCREEN_NON_INTERACTIVE },
  ];
  const iv = extractIntervals(ev, opt());
  assert.equal(day(iv).screenMs, 15 * M);
  const prev = summarizeDay(iv, '2026-10-19', D0 - 24 * H, D0, D0 + 30 * H, D0 - 48 * H);
  assert.equal(prev.screenMs, 10 * M - 1);
});

t('desligamento fecha a sessão e registra tempo desligado', () => {
  const ev = [
    { t: D0 + 14 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 14 * H + 1, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 14 * H + 10 * M, type: EV.DEVICE_SHUTDOWN },
    { t: D0 + 16 * H, type: EV.DEVICE_STARTUP },
    { t: D0 + 16 * H + 30000, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 16 * H + 60000, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 16 * H + 5 * M, type: EV.SCREEN_NON_INTERACTIVE },
  ];
  const d = day(extractIntervals(ev, opt()));
  assert.equal(d.screenMs, 10 * M - 1 + 4 * M);
  assert.equal(d.deviceOffMs, 2 * H - 10 * M);
});

t('eventos duplicados/inconsistentes não duplicam tempo', () => {
  const ev = [
    { t: D0 + 15 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 15 * H + 1, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 15 * H + 2, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 15 * H + 3, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 15 * H + 10 * M, type: EV.SCREEN_NON_INTERACTIVE },
    { t: D0 + 15 * H + 11 * M, type: EV.SCREEN_NON_INTERACTIVE },
  ];
  assert.equal(day(extractIntervals(ev, opt())).screenMs, 10 * M - 1);
});

t('tela inicial e o próprio IF Screen são medidos à parte (só dentro das sessões)', () => {
  const ev = [
    { t: D0 + 18 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 18 * H + 1000, type: EV.KEYGUARD_HIDDEN },
    { t: D0 + 18 * H + 1000, type: EV.ACTIVITY_RESUMED, pkg: 'launcher' },
    { t: D0 + 18 * H + 61000, type: EV.ACTIVITY_PAUSED, pkg: 'launcher' },
    { t: D0 + 18 * H + 61000, type: EV.ACTIVITY_RESUMED, pkg: 'br.edu.ifrn.ifscreen' },
    { t: D0 + 18 * H + 181000, type: EV.SCREEN_NON_INTERACTIVE },
    { t: D0 + 18 * H + 182000, type: EV.ACTIVITY_STOPPED, pkg: 'br.edu.ifrn.ifscreen' },
  ];
  const d = day(extractIntervals(ev, opt()));
  assert.equal(d.screenMs, 180000);
  assert.equal(d.launcherMs, 60000);
  assert.equal(d.ownAppMs, 120000);
});

t('sessão aberta conta até "agora" (dia em andamento)', () => {
  const ev = [
    { t: D0 + 20 * H, type: EV.SCREEN_INTERACTIVE },
    { t: D0 + 20 * H, type: EV.KEYGUARD_HIDDEN },
  ];
  const now = D0 + 20 * H + 7 * M;
  const d = day(extractIntervals(ev, opt({ nowMs: now })), now);
  assert.equal(d.screenMs, 7 * M);
  assert.equal(d.complete, false);
});

console.log(`\n${n} testes do algoritmo passaram`);
