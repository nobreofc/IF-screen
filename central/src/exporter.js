// Exportação CSV (padrão Excel pt-BR: separador ";" e vírgula decimal, com BOM UTF-8)
'use strict';

const { localDate, addDays } = require('./store');

const num = (v, dec = 1) => (v === null || v === undefined || Number.isNaN(v) ? '' : Number(v).toFixed(dec).replace('.', ','));
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const iso = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR') : '');

function table(header, rows) {
  return '﻿' + [header.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n') + '\r\n';
}

function buildCsv(store, kind, { from, to } = {}) {
  const t = localDate();
  from = from || '2000-01-01'; to = to || t;
  const devs = store.devices();
  if (kind === 'days') {
    const rows = [];
    for (const d of devs) {
      for (const x of store.days(d.deviceId, from, to)) {
        rows.push([d.participant || '', d.code, x.date, num(x.screenMin), num(x.screenMin - x.launcherMin), num(x.launcherMin),
          num(x.ownAppMin), x.ownLogMin === null ? '' : num(x.ownLogMin), num(x.deviceOffMin), x.sessionsN, x.longSessions,
          x.complete ? 'sim' : 'não', x.partialCoverage ? 'sim' : 'não', x.source, x.algo, x.channel, iso(x.receivedAt)]);
      }
    }
    return {
      filename: `ifscreen-tempo-de-tela-diario-${t}.csv`,
      content: table(['participante', 'codigo', 'data', 'tempo_tela_min', 'tempo_sem_tela_inicial_min', 'tela_inicial_min', 'proprio_app_min',
        'registro_proprio_min', 'aparelho_desligado_min', 'sessoes', 'sessoes_longas_4h', 'dia_completo', 'cobertura_parcial', 'fonte',
        'algoritmo', 'canal', 'recebido_em'], rows),
    };
  }
  if (kind === 'sessions') {
    const rows = [];
    for (const d of devs) {
      for (const x of store.days(d.deviceId, from, to)) {
        for (const [s, e] of store.sessions(d.deviceId, x.date)) {
          rows.push([d.participant || '', d.code, x.date, new Date(s).toLocaleTimeString('pt-BR'), new Date(e).toLocaleTimeString('pt-BR'), num((e - s) / 1000, 0), s, e]);
        }
      }
    }
    return {
      filename: `ifscreen-sessoes-${t}.csv`,
      content: table(['participante', 'codigo', 'data', 'inicio', 'fim', 'duracao_s', 'inicio_epoch_ms', 'fim_epoch_ms'], rows),
    };
  }
  if (kind === 'questionnaires') {
    const rows = store.questionnaires(from, to).map((q) => [q.participant || '', q.code, q.refDate, q.tv ? 'sim' : 'não', q.tvMin,
      q.pc ? 'sim' : 'não', q.pcMin, iso(q.answeredAt), q.channel]);
    return {
      filename: `ifscreen-questionarios-${t}.csv`,
      content: table(['participante', 'codigo', 'dia_de_referencia', 'usou_tv', 'tv_min', 'usou_computador', 'computador_min', 'respondido_em', 'canal'], rows),
    };
  }
  if (kind === 'validation') {
    const v = store.validation();
    const rows = v.pairs.map((p) => [p.subject, p.code, p.date, num(p.x), num(p.y), num(p.diff), p.y ? num(p.diff / p.y * 100) : '',
      num(p.x - p.launcherMin), num(p.x - p.launcherMin - p.y), p.complete ? 'sim' : 'não', p.note || '']);
    return {
      filename: `ifscreen-validacao-padrao-ouro-${t}.csv`,
      content: table(['participante', 'codigo', 'data', 'ifscreen_min', 'padrao_ouro_min', 'diferenca_min', 'diferenca_pct',
        'ifscreen_sem_tela_inicial_min', 'diferenca_sem_tela_inicial_min', 'dia_completo', 'observacao'], rows),
    };
  }
  throw new Error('tipo de exportação desconhecido');
}

module.exports = { buildCsv, addDays };
