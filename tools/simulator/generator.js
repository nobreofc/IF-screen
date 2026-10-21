// Gerador de eventos brutos realistas do Android (UsageEvents) com "verdade" conhecida.
'use strict';

const { EV } = require('../algorithm/screentime');

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Gera eventos de [t0, t1). Retorna { events, truth: [[s,e]...] } onde truth são os intervalos
 * reais de tela ligada + desbloqueada (o que o algoritmo deve reproduzir).
 */
function generateDevice(seed, t0, t1, profile = {}) {
  const r = rng(seed);
  const norm = () => { let u = 0; let v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const usesKeyguard = profile.usesKeyguard !== undefined ? profile.usesKeyguard : r() > 0.05;
  const lockDelayMs = profile.lockDelayMs !== undefined ? profile.lockDelayMs : (usesKeyguard && r() < 0.3 ? 5 * 60000 : 0);
  const heavy = 0.5 + r() * 1.5; // intensidade de uso do participante
  const events = []; const truth = [];
  const push = (t, type, pkg) => { events.push({ t: Math.round(t), type, pkg }); if (r() < 0.01 && type >= 15) events.push({ t: Math.round(t) + 1, type, pkg }); };
  const apps = ['com.whatsapp', 'com.instagram.android', 'com.google.android.youtube', 'com.android.chrome', 'com.zhiliaoapp.musically', 'com.spotify.music', 'br.edu.ifrn.ifscreen'];

  let t = t0;
  let locked = usesKeyguard; // começa à meia-noite com aparelho bloqueado
  let lockAt = null; // quando o bloqueio automático vai acontecer (atraso de bloqueio)
  const DAY = 86400000;
  while (t < t1) {
    const dayStart = t0 + Math.floor((t - t0) / DAY) * DAY;
    const wake = dayStart + (7 + norm() * 0.8) * 3600000;
    const sleep = dayStart + (23 + norm() * 0.8) * 3600000;
    // decide o próximo acontecimento
    const hourOfDay = (t - dayStart) / 3600000;
    const awake = t >= wake && t < sleep;
    const rate = awake ? 4.5 * heavy : 0.25; // sessões por hora
    const gap = -Math.log(1 - r()) / rate * 3600000;
    t += Math.max(20000, gap);
    if (t >= t1) break;
    // bloqueio automático pendente (atraso de bloqueio)
    if (lockAt !== null && t >= lockAt) { push(lockAt, EV.KEYGUARD_SHOWN); locked = true; lockAt = null; }

    const roll = r();
    if (roll < 0.03 && hourOfDay > 1) {
      // reinício / bateria acabou
      const off = r() < 0.7 ? 60000 + r() * 120000 : 3600000 * (1 + r() * 2);
      push(t, EV.DEVICE_SHUTDOWN);
      t += off;
      if (t >= t1) break;
      push(t, EV.DEVICE_STARTUP);
      locked = usesKeyguard; lockAt = null;
      if (usesKeyguard) push(t + 500, EV.KEYGUARD_SHOWN);
      t += 1000;
      continue;
    }
    if (roll < 0.30 && locked) {
      // notificação acende a tela, sem desbloqueio (deve ser DESCARTADO)
      push(t, EV.SCREEN_INTERACTIVE);
      t += 3000 + r() * 7000;
      push(t, EV.SCREEN_NON_INTERACTIVE);
      continue;
    }
    // sessão real de uso
    push(t, EV.SCREEN_INTERACTIVE);
    let start;
    if (locked) {
      const pin = 800 + r() * 3500; // digitando PIN / biometria (descartado)
      t += pin;
      if (r() < 0.04) { push(t, EV.SCREEN_NON_INTERACTIVE); continue; } // desistiu antes de desbloquear
      push(t, EV.KEYGUARD_HIDDEN);
      locked = false;
    }
    lockAt = null;
    start = t;
    // tela inicial por alguns segundos
    push(t, EV.ACTIVITY_RESUMED, 'com.android.launcher3');
    t += 1500 + r() * 8000;
    push(t, EV.ACTIVITY_PAUSED, 'com.android.launcher3');
    // duração: maioria curta, cauda longa (vídeo)
    let dur = Math.exp(Math.log(90000) + norm() * 1.1);
    if (r() < 0.02) dur = 3600000 * (1 + r() * 4); // maratona de vídeo (pode passar de 4 h)
    const app = apps[Math.floor(r() * apps.length)];
    push(t, EV.ACTIVITY_RESUMED, app);
    t += dur;
    push(t, EV.SCREEN_NON_INTERACTIVE);
    push(t + 300, EV.ACTIVITY_STOPPED, app);
    truth.push([Math.round(start), Math.round(Math.min(t, t1))]);
    if (usesKeyguard) {
      if (lockDelayMs && r() < 0.8) lockAt = t + lockDelayMs; // bloqueia só depois do atraso
      else { push(t + 50, EV.KEYGUARD_SHOWN); locked = true; }
    }
    t += 1000;
  }
  events.sort((a, b) => a.t - b.t);
  return { events: events.filter((e) => e.t < t1), truth: truth.filter(([s]) => s < t1), usesKeyguard, lockDelayMs };
}

module.exports = { generateDevice, rng };
