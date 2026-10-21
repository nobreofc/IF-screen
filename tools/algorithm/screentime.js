/*
 * IF Screen — Algoritmo de referência (algo "ifs-unlock-1")
 * Implementação idêntica (linha a linha) à de ScreenTimeEngine.kt no app Android.
 *
 * REGRA: conta tempo de tela somente enquanto o aparelho está DESBLOQUEADO
 * e com a tela LIGADA. A contagem começa no desbloqueio (KEYGUARD_HIDDEN, ou
 * tela ligada quando o aparelho não usa bloqueio) e termina no primeiro de:
 * tela apagada (SCREEN_NON_INTERACTIVE), bloqueio (KEYGUARD_SHOWN),
 * desligamento (DEVICE_SHUTDOWN). Sessões são cortadas à meia-noite local.
 *
 * Descartado por construção: tela acesa por notificação sem desbloqueio,
 * tela de bloqueio/AOD, digitação de PIN/biometria, áudio/vídeo/ligação com
 * tela apagada, aparelho desligado.
 */
'use strict';

const EV = {
  ACTIVITY_RESUMED: 1,
  ACTIVITY_PAUSED: 2,
  SCREEN_INTERACTIVE: 15,
  SCREEN_NON_INTERACTIVE: 16,
  KEYGUARD_SHOWN: 17,
  KEYGUARD_HIDDEN: 18,
  ACTIVITY_STOPPED: 23,
  DEVICE_SHUTDOWN: 26,
  DEVICE_STARTUP: 27,
};
const LONG_SESSION_MS = 4 * 3600 * 1000;

/**
 * @param {Array<{t:number,type:number,pkg?:string}>} events ordenados por t
 * @param {{nowMs:number, usesKeyguard:boolean, launchers:Set<string>, ownPkg:string}} opt
 * @returns {{sessions:Array<[number,number]>, launcher:Array<[number,number]>, own:Array<[number,number]>, offs:Array<[number,number]>}}
 */
function extractIntervals(events, opt) {
  let screenOn = false;
  let locked = !!opt.usesKeyguard;
  let usesKeyguard = !!opt.usesKeyguard;
  let start = -1; // início da sessão desbloqueada aberta
  let fgPkg = null; let fgStart = -1;
  let offStart = -1;
  const sessions = []; const fg = []; const offs = [];

  const open = (t) => { if (start < 0 && screenOn && !locked) start = t; };
  const close = (t) => { if (start >= 0) { if (t > start) sessions.push([start, t]); start = -1; } };
  const fgClose = (t) => { if (fgPkg !== null) { if (t > fgStart) fg.push([fgStart, t, fgPkg]); fgPkg = null; fgStart = -1; } };

  for (const e of events) {
    switch (e.type) {
      case EV.SCREEN_INTERACTIVE:
        screenOn = true; open(e.t); break;
      case EV.SCREEN_NON_INTERACTIVE:
        close(e.t); screenOn = false; break;
      case EV.KEYGUARD_SHOWN:
        usesKeyguard = true; close(e.t); locked = true; break;
      case EV.KEYGUARD_HIDDEN:
        locked = false; open(e.t); break;
      case EV.DEVICE_SHUTDOWN:
        close(e.t); fgClose(e.t); screenOn = false; locked = usesKeyguard;
        if (offStart < 0) offStart = e.t; break;
      case EV.DEVICE_STARTUP:
        close(e.t); fgClose(e.t); screenOn = false; locked = usesKeyguard;
        if (offStart >= 0 && e.t > offStart) offs.push([offStart, e.t]);
        offStart = -1; break;
      case EV.ACTIVITY_RESUMED:
        if (fgPkg !== e.pkg) { fgClose(e.t); fgPkg = e.pkg || ''; fgStart = e.t; }
        break;
      case EV.ACTIVITY_PAUSED:
      case EV.ACTIVITY_STOPPED:
        if (fgPkg !== null && fgPkg === e.pkg) fgClose(e.t);
        break;
      default: break;
    }
  }
  close(opt.nowMs);
  fgClose(opt.nowMs);
  const launcher = intersect(fg.filter((x) => opt.launchers.has(x[2])).map((x) => [x[0], x[1]]), sessions);
  const own = intersect(fg.filter((x) => x[2] === opt.ownPkg).map((x) => [x[0], x[1]]), sessions);
  return { sessions, launcher, own, offs };
}

/** Interseção de duas listas de intervalos (b é ordenada e sem sobreposição). */
function intersect(a, b) {
  const out = [];
  a = mergeIntervals(a);
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    const s = Math.max(a[i][0], b[j][0]); const e = Math.min(a[i][1], b[j][1]);
    if (e > s) out.push([s, e]);
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return out;
}
function mergeIntervals(list) {
  const s = list.slice().sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const it of s) {
    if (out.length && it[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], it[1]);
    else out.push([it[0], it[1]]);
  }
  return out;
}
function clip(list, a, b) {
  const out = [];
  for (const [s, e] of list) { const x = Math.max(s, a); const y = Math.min(e, b); if (y > x) out.push([x, y]); }
  return out;
}
const sum = (list) => list.reduce((acc, [s, e]) => acc + (e - s), 0);

/**
 * Resumo de um dia [dayStart, dayEnd).
 * @param {object} iv resultado de extractIntervals
 * @param {number} coverageFrom timestamp do evento mais antigo disponível no log do sistema
 */
function summarizeDay(iv, date, dayStart, dayEnd, nowMs, coverageFrom, extra = {}) {
  const end = Math.min(dayEnd, nowMs);
  const sessions = clip(iv.sessions, dayStart, end);
  return {
    date,
    screenMs: sum(sessions),
    launcherMs: sum(clip(iv.launcher, dayStart, end)),
    ownAppMs: sum(clip(iv.own, dayStart, end)),
    deviceOffMs: sum(clip(iv.offs, dayStart, end)),
    sessions,
    longSessions: sessions.filter(([s, e]) => e - s >= LONG_SESSION_MS).length,
    complete: nowMs >= dayEnd && coverageFrom <= dayStart,
    partialCoverage: coverageFrom > dayStart,
    algo: 'ifs-unlock-1',
    ...extra,
  };
}

module.exports = { EV, extractIntervals, summarizeDay, intersect, mergeIntervals, clip, sum };
