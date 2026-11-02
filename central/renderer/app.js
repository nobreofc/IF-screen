/* IF Screen — Central (interface) */
'use strict';

// ------------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const G = { g900: '#0E3B1B', g800: '#145226', g700: '#1D6E31', g600: '#2F9E41', g500: '#45B556', g300: '#9AD7A3', g200: '#C7EACC', g100: '#E5F5E8', line: '#E1E8E3', muted: '#637268', red: '#C8191E', amber: '#A86206' };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Minutos → "3 h 42 min" (truncado ao minuto, como o Bem-estar Digital exibe). */
function fmtDur(min, { zero = '0 min' } = {}) {
  if (min === null || min === undefined || Number.isNaN(min)) return '—';
  const m = Math.floor(min + 1e-9);
  if (m <= 0) return min > 0 ? '< 1 min' : zero;
  const h = Math.floor(m / 60); const r = m % 60;
  return h ? `${h} h ${String(r).padStart(2, '0')} min` : `${r} min`;
}
const fmtNum = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtSigned = (v, d = 1) => (v === null || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : ''}${fmtNum(v, d)}`);
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function ymd(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
const fmtDate = (s) => (s ? s.split('-').reverse().join('/') : '—');
const fmtDateShort = (s) => { const d = parseDate(s); return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const fmtDateLong = (s) => { const d = parseDate(s); return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`; };
function fmtAgo(ts) {
  if (!ts) return 'nunca';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function mondayOf(s) { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); }
function parseRef(v) {
  // aceita "3:42", "3h42", "3 h 42 min", "222" (minutos)
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*(?:min|m)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  m = s.match(/^(\d{1,4})\s*(?:min|m)?$/);
  if (m) return Number(m[1]);
  return NaN;
}
const minToHM = (m) => (m === null || m === undefined ? '' : `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`);
function diffClass(d) { const a = Math.abs(d); return a <= 1 ? 'diff-ok' : a <= 5 ? 'diff-mid' : 'diff-bad'; }

let toastT = null;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = `toast show${err ? ' err' : ''}`;
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, 3200);
}

const ICON = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/><path d="M3 3h18v18H3z" opacity=".0"/>',
  scale: '<path d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M6 14h12v7H6z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24">${ICON[n]}</svg>`;
const LOGO_SVG = '<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#2F9E41"/><rect x="20" y="9" width="24" height="46" rx="6" fill="none" stroke="#fff" stroke-width="3.6"/><circle cx="32" cy="30.5" r="8.2" fill="none" stroke="#fff" stroke-width="3"/><path d="M32 26v4.6l3.2 2.1" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="27.5" y="47" width="9" height="2.8" rx="1.4" fill="#fff"/></svg>';

// ------------------------------------------------------------------ gráficos
if (window.Chart) {
  Chart.defaults.font.family = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
  Chart.defaults.color = G.muted;
  Chart.defaults.borderColor = G.line;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.animation = { duration: 250 };
}
const charts = [];
function chart(canvas, cfg) { const c = new Chart(canvas, cfg); charts.push(c); return c; }
function destroyCharts() { while (charts.length) charts.pop().destroy(); }
const minTicks = { precision: 0, callback: (v) => (v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? String(v % 60).padStart(2, '0') : ''}` : `${v}m`) };
const tipDur = { callbacks: { label: (c) => ` ${fmtDur(c.parsed.y)}` } };

// ------------------------------------------------------------------ estado e navegação
const S = { view: 'painel', params: {}, today: null, settings: {}, pending: 0 };
const NAV = [
  ['painel', 'Painel', 'home'], ['aparelhos', 'Aparelhos', 'phone'], ['questionarios', 'Questionários', 'form'],
  ['validacao', 'Validação', 'scale'], ['relatorios', 'Relatórios', 'file'], ['protocolo', 'Protocolo de medição', 'book'],
  ['config', 'Configurações', 'gear'], ['saber', 'Saber mais', 'info'],
];
function renderNav() {
  $('#nav').innerHTML = NAV.map(([k, label, ic]) => `<a data-v="${k}" class="${S.view === k || (k === 'aparelhos' && S.view === 'device') ? 'on' : ''}">${ico(ic)}${label}${k === 'aparelhos' && S.pending ? `<span class="badge">${S.pending}</span>` : ''}</a>`).join('');
  $$('#nav a').forEach((a) => a.addEventListener('click', () => go(a.dataset.v)));
}
function go(view, params = {}) {
  S.view = view; S.params = params;
  $('#main').scrollTop = 0;
  render();
}
let rendering = false; let rerender = false;
async function render() {
  if (rendering) { rerender = true; return; }
  rendering = true;
  try {
    destroyCharts();
    renderNav();
    const v = VIEWS[S.view] || VIEWS.painel;
    await v($('#page'));
    renderNav();
  } catch (e) {
    console.error(e);
    $('#page').innerHTML = `<div class="banner r">Erro ao carregar a tela: ${esc(e.message)}</div>`;
  } finally {
    rendering = false;
    if (rerender) { rerender = false; render(); }
  }
}
async function refreshStatus() {
  const st = await api.status();
  S.status = st; S.today = st.today;
  const dl = $('#dotLocal'); const tl = $('#txtLocal');
  if (st.localPort) { dl.className = 'dot ok'; tl.textContent = `Rede local · porta ${st.localPort}`; }
  else { dl.className = 'dot err'; tl.textContent = st.localError || 'Rede local parada'; }
  const dr = $('#dotRelay'); const tr = $('#txtRelay');
  if (S.settings.relayEnabled !== 'true') { dr.className = 'dot off'; tr.textContent = 'Nuvem desativada'; }
  else if (st.relay && st.relay.ok) { dr.className = 'dot ok'; tr.textContent = `Nuvem · ${fmtAgo(st.relay.lastPull)}`; }
  else if (st.relay && st.relay.ok === false) { dr.className = 'dot err'; tr.textContent = 'Nuvem com erro'; }
  else { dr.className = 'dot'; tr.textContent = 'Nuvem conectando…'; }
}
async function refreshBrand() {
  S.settings = await api.settings();
  const logo = await api.logo();
  $('#inst').innerHTML = logo ? `<img src="${logo}" alt="${esc(S.settings.institution)}">` : `<span class="chip g">${esc(S.settings.institution || 'IFRN')}</span>`;
  S.logo = logo;
}

// ------------------------------------------------------------------ componentes
const kpi = (label, value, detail = '', hl = false) => `<div class="card kpi${hl ? ' hl' : ''}"><div class="l">${label}</div><div class="v">${value}</div>${detail ? `<div class="d">${detail}</div>` : ''}</div>`;
function durHtml(min) {
  if (min === null || min === undefined) return '—';
  const m = Math.floor(min); const h = Math.floor(m / 60); const r = m % 60;
  return h ? `${h}<small>h</small> ${String(r).padStart(2, '0')}<small>min</small>` : `${r}<small>min</small>`;
}
function spark(vals) {
  const max = Math.max(1, ...vals.filter((v) => v !== null));
  const mi = vals.indexOf(Math.max(...vals.filter((v) => v !== null)));
  return `<div class="spark">${vals.map((v, i) => (v === null ? '<i class="none" style="height:2px"></i>' : `<i class="${i === mi && v > 0 ? 'max' : ''}" style="height:${Math.max(2, (v / max) * 26)}px" title="${fmtDur(v)}"></i>`)).join('')}</div>`;
}
const channelChip = (c) => (c === 'local' ? '<span class="chip g">Rede local</span>' : c === 'nuvem' ? '<span class="chip b">Nuvem</span>' : '<span class="chip">—</span>');
function alertChips(alerts) {
  if (!alerts || !alerts.length) return '<span class="chip g">OK</span>';
  return alerts.map((a) => `<span class="chip ${a.level === 'error' ? 'r' : 'a'}">${esc(a.text)}</span>`).join(' ');
}
function dayStatus(d, today) {
  if (!d) return '<span class="chip">Sem dados</span>';
  if (d.date === today && !d.complete) return '<span class="chip b">Em andamento</span>';
  if (d.partialCoverage) return '<span class="chip a">Cobertura parcial</span>';
  return d.complete ? '<span class="chip g">Completo</span>' : '<span class="chip a">Incompleto</span>';
}
const initials = (s) => String(s || '?').replace(/[^0-9A-Za-zÀ-ú]/g, '').slice(0, 4).toUpperCase();

// ------------------------------------------------------------------ telas
const VIEWS = {};

VIEWS.painel = async (el) => {
  const o = await api.overview();
  S.pending = o.pending;
  const st = S.status || {};
  const test = S.settings.showScreenTime === 'true';
  el.innerHTML = `
    <div class="head"><div><h1>Painel</h1><div class="sub">${fmtDateLong(o.today)} · ${o.kpis.linked} aparelho(s) no estudo</div></div>
      <div class="actions"><button class="btn" id="bSync">${ico('sync')}Sincronizar agora</button></div></div>
    ${test ? `<div class="banner a"><div class="bt"><b>Modo teste ativo.</b> Os participantes veem no celular o tempo medido — útil para conferir com o padrão-ouro, mas pode alterar o comportamento. Desative antes da coleta oficial.</div><button class="btn sm" data-go="config">Configurações</button></div>` : ''}
    ${o.pending ? `<div class="banner g"><div class="bt"><b>${o.pending} aparelho(s) aguardando vínculo.</b> Peça o código exibido no app e vincule ao participante.</div><button class="btn sm p" data-go="aparelhos">Vincular</button></div>` : ''}
    <div class="grid g4">
      ${kpi('Aparelhos vinculados', o.kpis.linked, `${o.pending} aguardando vínculo`, true)}
      ${kpi('Ativos nas últimas 24 h', `${o.kpis.active24h}<small>/${o.kpis.linked}</small>`, 'enviaram dados recentemente')}
      ${kpi('Média diária de tempo de tela', durHtml(o.kpis.meanDaily), 'dias completos, últimos 7 dias')}
      ${kpi('Questionários de ontem', `${o.kpis.answeredYesterday}<small>/${o.kpis.linked}</small>`, fmtDate(o.yesterday))}
    </div>
    <div class="grid g21 mt">
      <div class="card"><h2>Média diária do grupo</h2><p class="hint">Tempo de tela médio por aparelho, últimos 14 dias (o dia de hoje está em andamento)</p><div class="chartbox"><canvas id="cMeans"></canvas></div></div>
      <div class="card"><h2>Conexões</h2><p class="hint">Como os celulares chegam até esta Central</p>
        <div class="stat-list">
          <span class="k">Rede local (in loco)</span><span class="v">${st.localPort ? '<span class="chip g">Ativa</span>' : '<span class="chip r">Parada</span>'}</span>
          <span class="k">Endereço na rede</span><span class="v mono">${(st.ips || []).map((i) => `${i.address}:${st.localPort || ''}`).join('<br>') || '—'}</span>
          <span class="k">Nuvem (Railway)</span><span class="v">${S.settings.relayEnabled !== 'true' ? '<span class="chip">Desativada</span>' : st.relay && st.relay.ok ? '<span class="chip g">Conectada</span>' : '<span class="chip a">Sem conexão</span>'}</span>
          <span class="k">Última leitura da nuvem</span><span class="v">${st.relay && st.relay.lastPull ? fmtAgo(st.relay.lastPull) : '—'}</span>
        </div>
        ${st.relay && st.relay.lastError ? `<div class="banner r mt" style="margin-bottom:0">${esc(st.relay.lastError)}</div>` : ''}
      </div>
    </div>
    <div class="card mt"><h2>Aparelhos</h2><p class="hint">Clique em um aparelho para ver o uso diário, semanal e mensal</p>
      ${o.rows.length ? `<table class="t"><thead><tr><th>Participante</th><th>Código</th><th>Aparelho</th><th class="n">Hoje</th><th class="n">Ontem</th><th class="n">Média 7 dias</th><th>Últimos 7 dias</th><th>Questionário</th><th>Contato</th><th>Situação</th></tr></thead><tbody>
      ${o.rows.map((r) => `<tr class="click" data-dev="${esc(r.deviceId)}">
        <td class="strong">${esc(r.participant)}</td><td class="mono">${esc(r.code)}</td>
        <td>${esc([r.info.manufacturer, r.info.model].filter(Boolean).join(' ') || '—')}</td>
        <td class="n">${fmtDur(r.today)}</td><td class="n">${fmtDur(r.yesterday)}</td><td class="n strong">${fmtDur(r.mean7)}</td>
        <td>${spark(r.last7)}</td>
        <td>${r.answeredYesterday ? '<span class="chip g">Respondido</span>' : '<span class="chip a">Pendente</span>'}</td>
        <td>${fmtAgo(r.lastSeen)} ${channelChip(r.lastChannel)}</td><td>${alertChips(r.alerts)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty"><b>Nenhum aparelho vinculado ainda</b>Instale o app IF Screen no celular, abra-o e vincule o código exibido em “Aparelhos”.</div>'}
    </div>`;
  $('#bSync').onclick = async () => { await api.syncNow(); await refreshStatus(); toast('Sincronização concluída'); render(); };
  $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  $$('tr[data-dev]', el).forEach((tr) => tr.addEventListener('click', () => go('device', { id: tr.dataset.dev, tab: 'dia' })));
  chart($('#cMeans'), {
    type: 'bar',
    data: { labels: o.dailyMeans.map((d) => fmtDateShort(d.date)), datasets: [{ data: o.dailyMeans.map((d) => d.meanMin), backgroundColor: o.dailyMeans.map((d) => (d.date === o.today ? G.g200 : G.g600)), borderRadius: 6, maxBarThickness: 34 }] },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: minTicks }, x: { grid: { display: false } } }, plugins: { tooltip: tipDur } },
  });
};

VIEWS.aparelhos = async (el) => {
  const devs = await api.devices();
  const pending = devs.filter((d) => !d.linked); const linked = devs.filter((d) => d.linked);
  S.pending = pending.length;
  el.innerHTML = `
    <div class="head"><div><h1>Aparelhos</h1><div class="sub">Vínculo dos celulares aos participantes pelo código único</div></div></div>
    <div class="grid g21">
      <div class="card"><h2>Vincular aparelho</h2><p class="hint">Abra o IF Screen no celular do participante: o código único aparece na tela inicial (ex.: IFS-7K3M-Q9PD). O celular precisa ter se conectado pelo menos uma vez (rede local ou internet).</p>
        <div class="row">
          <div class="field" style="flex:1.3"><label>Código do aparelho</label><input class="in code" id="fCode" placeholder="IFS-XXXX-XXXX" maxlength="13" autocomplete="off"></div>
          <div class="field" style="flex:1"><label>Participante</label><input class="in" id="fPart" placeholder="ex.: P001" maxlength="40"></div>
          <button class="btn p" id="bLink">${ico('link')}Vincular</button>
        </div>
        <div id="linkMsg"></div>
      </div>
      <div class="card"><h2>Como o celular chega aqui</h2><p class="hint" style="margin:0">Na mesma rede Wi-Fi, o app encontra esta Central sozinho. Fora dela, usa o servidor-ponte na nuvem (Railway). Os dados ficam guardados no celular até a Central confirmar o recebimento.</p></div>
    </div>
    <div class="card mt"><h2>Aguardando vínculo <span class="chip">${pending.length}</span></h2><p class="hint">Aparelhos que já se apresentaram à Central, mas ainda não foram associados a um participante</p>
      ${pending.length ? `<table class="t"><thead><tr><th>Código</th><th>Aparelho</th><th>Android</th><th>Primeiro contato</th><th>Último contato</th><th></th></tr></thead><tbody>
      ${pending.map((d) => `<tr><td class="mono strong">${esc(d.code)}</td><td>${esc([d.info.manufacturer, d.info.model].filter(Boolean).join(' '))}</td><td>${esc(d.info.androidVersion || '')}</td>
        <td>${new Date(d.registeredAt).toLocaleString('pt-BR')}</td><td>${fmtAgo(d.lastSeen)} ${channelChip(d.lastChannel)}</td>
        <td class="n"><button class="btn sm" data-fill="${esc(d.code)}">Usar código</button> <button class="btn sm ghost danger" data-del="${esc(d.deviceId)}" data-name="${esc(d.code)}" title="Excluir os dados deste aparelho (LGPD)">Excluir</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum aparelho aguardando.</div>'}
    </div>
    <div class="card mt"><h2>Vinculados <span class="chip g">${linked.length}</span></h2><p class="hint">O início do estudo (D1) é o dia seguinte ao vínculo; pode ser ajustado</p>
      ${linked.length ? `<table class="t"><thead><tr><th>Participante</th><th>Código</th><th>Aparelho</th><th>App</th><th>Vinculado em</th><th>Início do estudo (D1)</th><th>Contato</th><th></th></tr></thead><tbody>
      ${linked.map((d) => `<tr><td class="strong">${esc(d.participant)}</td><td class="mono">${esc(d.code)}</td><td>${esc([d.info.manufacturer, d.info.model].filter(Boolean).join(' '))} · Android ${esc(d.info.androidVersion || '?')}</td>
        <td>${esc(d.hb.appVersion || d.info.appVersion || '')}</td><td>${d.linkedAt ? new Date(d.linkedAt).toLocaleString('pt-BR') : ''}</td>
        <td><input type="date" class="in" value="${esc(d.studyStart || '')}" data-ss="${esc(d.deviceId)}"></td>
        <td>${fmtAgo(d.lastSeen)} ${channelChip(d.lastChannel)}</td>
        <td class="n"><button class="btn sm" data-open="${esc(d.deviceId)}">Abrir</button> <button class="btn sm ghost" data-unlink="${esc(d.deviceId)}" data-name="${esc(d.participant)}">Desvincular</button> <button class="btn sm ghost danger" data-del="${esc(d.deviceId)}" data-name="${esc(d.participant)}" title="Excluir todos os dados deste participante (LGPD)">Excluir dados</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum aparelho vinculado.</div>'}
    </div>
    <div class="banner g mt">${ico('shield').replace('<svg', '<svg width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" style="flex:none"')}<div class="bt"><b>Privacidade.</b> Use códigos (ex.: P001) para identificar participantes, nunca o nome. <b>Desvincular</b> mantém os dados já recebidos; <b>Excluir dados</b> apaga tudo do participante e retira o aparelho do estudo, como pede a LGPD quando o participante ou o responsável solicita a exclusão ou retira o consentimento.</div></div>`;
  const code = $('#fCode');
  code.addEventListener('input', () => {
    let v = code.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (v.startsWith('IFS')) v = v.slice(3);
    v = v.slice(0, 8);
    code.value = v.length ? `IFS-${v.slice(0, 4)}${v.length > 4 ? '-' + v.slice(4) : ''}` : '';
  });
  $('#bLink').onclick = async () => {
    let r = await api.link({ code: code.value, participant: $('#fPart').value });
    if (!r.ok && r.notFound && S.settings.relayEnabled === 'true') { await api.syncNow(); r = await api.link({ code: code.value, participant: $('#fPart').value }); }
    if (r.ok) { toast('Aparelho vinculado'); go('device', { id: r.deviceId, tab: 'dia' }); }
    else $('#linkMsg').innerHTML = `<div class="banner r mt" style="margin-bottom:0">${esc(r.error)}</div>`;
  };
  $$('[data-fill]', el).forEach((b) => b.addEventListener('click', () => { code.value = b.dataset.fill; $('#fPart').focus(); }));
  $$('[data-open]', el).forEach((b) => b.addEventListener('click', () => go('device', { id: b.dataset.open, tab: 'dia' })));
  $$('[data-unlink]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Desvincular ${b.dataset.name}? Os dados já recebidos são mantidos.`)) return;
    await api.unlink(b.dataset.unlink); toast('Aparelho desvinculado'); render();
  }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    const n = b.dataset.name;
    if (!confirm(`Excluir TODOS os dados de ${n}?\n\nSerão apagados o tempo de tela, as sessões, os questionários e os valores de referência. O aparelho é retirado do estudo e não poderá enviar novos dados. A ponte na nuvem também é avisada para apagar o que tiver.\n\nUse quando o participante ou o responsável pedir a exclusão ou retirar o consentimento. Não é possível desfazer.`)) return;
    if (!confirm(`Confirma a exclusão definitiva dos dados de ${n}?`)) return;
    const r = await api.deleteDevice(b.dataset.del);
    if (r && r.ok) toast(`Dados de ${n} excluídos. As cópias de segurança automáticas antigas são substituídas em até 14 dias.`);
    else toast((r && r.error) || 'Não foi possível excluir', true);
    render();
  }));
  $$('[data-ss]', el).forEach((i) => i.addEventListener('change', async () => { await api.setStudyStart({ deviceId: i.dataset.ss, date: i.value }); toast('Início do estudo atualizado'); }));
};

// ------------------------------------------------------------------ detalhe do aparelho
VIEWS.device = async (el) => {
  const d = await api.device(S.params.id);
  if (!d) { go('aparelhos'); return; }
  const today = S.today;
  const tab = S.params.tab || 'dia';
  const hb = d.hb || {};
  const alerts = [];
  if (hb.usageAccess === false) alerts.push('<span class="chip r">Acesso ao uso desativado</span>');
  if (hb.batteryOptIgnored === false) alerts.push('<span class="chip a">Otimização de bateria ativa</span>');
  if (hb.notifPerm === false) alerts.push('<span class="chip a">Notificações bloqueadas</span>');
  el.innerHTML = `
    <div class="back" id="bBack">${ico('left').replace('<svg', '<svg width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"')}Aparelhos</div>
    <div class="dhead"><div class="avatar">${esc(initials(d.participant || d.code))}</div>
      <div><h1>${esc(d.participant || 'Sem participante')}</h1>
        <div class="meta"><span class="chip mono">${esc(d.code)}</span>${esc([d.info.manufacturer, d.info.model].filter(Boolean).join(' '))} · Android ${esc(d.info.androidVersion || '?')} · app ${esc(hb.appVersion || d.info.appVersion || '?')}
        · contato ${fmtAgo(d.lastSeen)} ${channelChip(d.lastChannel)} ${alerts.join(' ')}</div></div></div>
    <div class="tabs">${[['dia', 'Diário'], ['semana', 'Semanal'], ['mes', 'Mensal'], ['quest', 'Questionário'], ['qual', 'Qualidade dos dados']].map(([k, l]) => `<a data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>
    <div id="tabBody"></div>`;
  $('#bBack').onclick = () => go('aparelhos');
  $$('[data-tab]', el).forEach((a) => a.addEventListener('click', () => { S.params.tab = a.dataset.tab; render(); }));
  const body = $('#tabBody');
  if (tab === 'dia') await tabDay(body, d, today);
  else if (tab === 'semana') await tabWeek(body, d, today);
  else if (tab === 'mes') await tabMonth(body, d, today);
  else if (tab === 'quest') await tabQuest(body, d, today);
  else await tabQuality(body, d, today);
};

function dateNav(label, extra = '') {
  return `<div class="nav-date"><button class="btn sm" id="bPrev">${ico('left')}</button><div class="lbl">${label}</div><button class="btn sm" id="bNext">${ico('right')}</button>${extra}</div>`;
}

async function tabDay(body, d, today) {
  const date = S.params.date || today;
  const [days, hours, sessions] = await Promise.all([
    api.days({ deviceId: d.deviceId, from: date, to: date }), api.hourly({ deviceId: d.deviceId, date }), api.sessions({ deviceId: d.deviceId, date }),
  ]);
  const x = days[0];
  const longest = sessions.reduce((m, [s, e]) => Math.max(m, e - s), 0) / 60000;
  const [y, mo, dd] = date.split('-').map(Number); const base = new Date(y, mo - 1, dd).getTime();
  body.innerHTML = `
    <div class="head" style="margin-bottom:14px"><div>${dateNav(fmtDateLong(date), `<input type="date" class="in" id="iDate" value="${date}" style="margin-left:8px"><button class="btn sm" id="bToday">Hoje</button>`)}</div><div>${dayStatus(x, today)}</div></div>
    <div class="grid g4">
      ${kpi('Tempo de tela', durHtml(x ? x.screenMin : null), x ? `${fmtNum(x.screenMin, 2)} min exatos` : 'sem dados para este dia', true)}
      ${kpi('Sessões (desbloqueio → bloqueio)', x ? x.sessionsN : '—', sessions.length ? `média ${fmtDur(x.screenMin / Math.max(1, x.sessionsN))} por sessão` : '')}
      ${kpi('Maior sessão', durHtml(sessions.length ? longest : null), x && x.longSessions ? `${x.longSessions} sessão(ões) acima de 4 h` : 'contínua, sem bloquear')}
      ${kpi('Sem a tela inicial', durHtml(x ? x.screenMin - x.launcherMin : null), x ? `tela inicial: ${fmtDur(x.launcherMin)}` : '')}
    </div>
    <div class="card mt"><h2>Distribuição ao longo do dia</h2><p class="hint">Minutos de tela desbloqueada em cada hora</p><div class="chartbox"><canvas id="cHours"></canvas></div>
      <h2 class="mt" style="margin-top:18px">Linha do tempo</h2><p class="hint">Cada faixa verde é uma sessão — do desbloqueio até a tela apagar ou bloquear</p>
      <div class="timeline">${sessions.map(([s, e]) => `<i style="left:${((s - base) / 864e5) * 100}%;width:${((e - s) / 864e5) * 100}%" title="${fmtTime(s)} – ${fmtTime(e)} (${fmtDur((e - s) / 60000)})"></i>`).join('')}</div>
      <div class="tl-axis">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<span>${String(h).padStart(2, '0')}h</span>`).join('')}</div>
    </div>
    <div class="card mt"><h2>Sessões do dia <span class="chip">${sessions.length}</span></h2>
      ${sessions.length ? `<table class="t"><thead><tr><th>#</th><th>Desbloqueio</th><th>Fim</th><th class="n">Duração</th></tr></thead><tbody>
        ${sessions.map(([s, e], i) => `<tr><td class="muted">${i + 1}</td><td>${fmtTime(s)}</td><td>${fmtTime(e)}</td><td class="n">${(e - s) >= 60000 ? fmtDur((e - s) / 60000) : `${Math.round((e - s) / 1000)} s`}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma sessão registrada neste dia.</div>'}
    </div>`;
  const set = (dt) => { S.params.date = dt; render(); };
  $('#bPrev').onclick = () => set(addDays(date, -1));
  $('#bNext').onclick = () => set(addDays(date, 1));
  $('#bToday').onclick = () => set(today);
  $('#iDate').onchange = (e) => e.target.value && set(e.target.value);
  chart($('#cHours'), {
    type: 'bar',
    data: { labels: hours.map((_, h) => `${String(h).padStart(2, '0')}h`), datasets: [{ data: hours, backgroundColor: G.g600, borderRadius: 4, maxBarThickness: 26 }] },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, suggestedMax: 10, ticks: { callback: (v) => `${v} min` } }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${fmtNum(c.parsed.y, 1)} min` } } } },
  });
}

async function tabWeek(body, d, today) {
  const studyStart = d.studyStart;
  let start = S.params.weekStart;
  if (!start) start = studyStart && studyStart <= today ? studyStart : mondayOf(today);
  const end = addDays(start, 6);
  const [days, qs] = await Promise.all([api.days({ deviceId: d.deviceId, from: start, to: end }), api.questionnaires({ from: start, to: end })]);
  const byDate = Object.fromEntries(days.map((x) => [x.date, x]));
  const qBy = Object.fromEntries(qs.filter((q) => q.deviceId === d.deviceId).map((q) => [q.refDate, q]));
  const dates = [...Array(7)].map((_, i) => addDays(start, i));
  const vals = dates.map((dt) => (byDate[dt] ? byDate[dt].screenMin : null));
  const complete = dates.map((dt) => byDate[dt]).filter((x) => x && x.complete);
  const total = vals.reduce((s, v) => s + (v || 0), 0);
  const meanC = complete.length ? complete.reduce((s, x) => s + x.screenMin, 0) / complete.length : null;
  let maxI = -1; vals.forEach((v, i) => { if (v !== null && (maxI < 0 || v > vals[maxI])) maxI = i; });
  let dIdx = null;
  if (studyStart) { const diff = Math.round((parseDate(start) - parseDate(studyStart)) / 864e5); if (diff % 7 === 0 && diff >= 0) dIdx = diff; }
  const label = dIdx !== null ? `Período do estudo · D${dIdx + 1}–D${dIdx + 7}` : `${fmtDate(start)} a ${fmtDate(end)}`;
  body.innerHTML = `
    <div class="head" style="margin-bottom:14px"><div>${dateNav(label)}</div>
      <div class="actions">${studyStart ? '<button class="btn sm" id="bStudy">Período do estudo</button>' : ''}<button class="btn sm" id="bCur">Semana atual</button></div></div>
    <div class="grid g4">
      ${kpi('Total na semana', durHtml(total), `${days.length} dia(s) com dados`, true)}
      ${kpi('Média por dia', durHtml(meanC), `${complete.length} dia(s) completo(s)`)}
      ${kpi('Dia de maior uso', maxI >= 0 ? fmtDateShort(dates[maxI]) : '—', maxI >= 0 ? fmtDur(vals[maxI]) : '')}
      ${kpi('Questionários respondidos', `${dates.filter((dt) => qBy[dt]).length}<small>/7</small>`, 'dias de referência na semana')}
    </div>
    <div class="card mt"><h2>Tempo de tela por dia</h2><p class="hint">A barra escura marca o dia de maior uso; a linha tracejada é a média dos dias completos</p><div class="chartbox tall"><canvas id="cWeek"></canvas></div></div>
    <div class="card mt"><h2>Detalhe da semana</h2>
      <table class="t"><thead><tr><th>Dia</th>${dIdx !== null ? '<th>Estudo</th>' : ''}<th class="n">Tempo de tela</th><th class="n">Sessões</th><th class="n">Sem tela inicial</th><th>TV (autorrelato)</th><th>Computador (autorrelato)</th><th>Situação</th></tr></thead><tbody>
      ${dates.map((dt, i) => { const x = byDate[dt]; const q = qBy[dt]; return `<tr class="click" data-day="${dt}"><td class="strong">${fmtDateShort(dt)}</td>${dIdx !== null ? `<td><span class="chip g">D${dIdx + i + 1}</span></td>` : ''}
        <td class="n ${i === maxI ? 'strong' : ''}">${fmtDur(x ? x.screenMin : null)}</td><td class="n">${x ? x.sessionsN : '—'}</td><td class="n">${x ? fmtDur(x.screenMin - x.launcherMin) : '—'}</td>
        <td>${q ? (q.tv ? fmtDur(q.tvMin) : 'Não usou') : '<span class="muted">—</span>'}</td><td>${q ? (q.pc ? fmtDur(q.pcMin) : 'Não usou') : '<span class="muted">—</span>'}</td>
        <td>${dayStatus(x, today)}</td></tr>`; }).join('')}</tbody></table></div>`;
  const set = (s) => { S.params.weekStart = s; render(); };
  $('#bPrev').onclick = () => set(addDays(start, -7));
  $('#bNext').onclick = () => set(addDays(start, 7));
  $('#bCur').onclick = () => set(mondayOf(today));
  if ($('#bStudy')) $('#bStudy').onclick = () => set(studyStart);
  $$('[data-day]', body).forEach((tr) => tr.addEventListener('click', () => { S.params.tab = 'dia'; S.params.date = tr.dataset.day; render(); }));
  chart($('#cWeek'), {
    type: 'bar',
    data: {
      labels: dates.map((dt, i) => (dIdx !== null ? [`D${dIdx + i + 1}`, fmtDateShort(dt)] : fmtDateShort(dt))),
      datasets: [
        { type: 'bar', data: vals, backgroundColor: vals.map((v, i) => (i === maxI ? G.g800 : G.g500)), borderRadius: 8, maxBarThickness: 64 },
        { type: 'line', data: dates.map(() => meanC), borderColor: G.amber, borderDash: [6, 5], borderWidth: 2, pointRadius: 0 },
      ],
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: minTicks }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => (c.datasetIndex ? ` média ${fmtDur(c.parsed.y)}` : ` ${fmtDur(c.parsed.y)}`) } } } },
  });
}

async function tabMonth(body, d, today) {
  const month = S.params.month || today.slice(0, 7);
  const [yy, mm] = month.split('-').map(Number);
  const first = `${month}-01`; const last = ymd(new Date(yy, mm, 0));
  const days = await api.days({ deviceId: d.deviceId, from: first, to: last });
  const byDate = Object.fromEntries(days.map((x) => [x.date, x]));
  const n = Number(last.slice(8)); const dates = [...Array(n)].map((_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const vals = dates.map((dt) => (byDate[dt] ? byDate[dt].screenMin : null));
  const max = Math.max(0, ...vals.filter((v) => v !== null));
  const complete = days.filter((x) => x.complete);
  const meanC = complete.length ? complete.reduce((s, x) => s + x.screenMin, 0) / complete.length : null;
  const total = days.reduce((s, x) => s + x.screenMin, 0);
  const maxDate = max > 0 ? dates[vals.indexOf(max)] : null;
  const lead = (parseDate(first).getDay() + 6) % 7;
  const shade = (v) => { if (v === null) return '#fff'; const t = max ? v / max : 0; const a = 0.12 + t * 0.88; return `rgba(47,158,65,${a.toFixed(2)})`; };
  body.innerHTML = `
    <div class="head" style="margin-bottom:14px"><div>${dateNav(`${MONTHS[mm - 1][0].toUpperCase()}${MONTHS[mm - 1].slice(1)} de ${yy}`)}</div></div>
    <div class="grid g4">
      ${kpi('Total no mês', durHtml(total), `${days.length} dia(s) com dados`, true)}
      ${kpi('Média por dia', durHtml(meanC), `${complete.length} dia(s) completo(s)`)}
      ${kpi('Dia de maior uso', maxDate ? fmtDateShort(maxDate) : '—', maxDate ? fmtDur(max) : '')}
      ${kpi('Média semanal estimada', durHtml(meanC !== null ? meanC * 7 : null), 'média diária × 7')}
    </div>
    <div class="grid g2 mt">
      <div class="card"><h2>Calendário de uso</h2><p class="hint">Quanto mais escuro, maior o tempo de tela no dia</p>
        <div class="cal">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((w) => `<div class="wd">${w}</div>`).join('')}
          ${'<div class="c out"></div>'.repeat(lead)}
          ${dates.map((dt, i) => { const v = vals[i]; const dark = v !== null && max && v / max > 0.55; return `<div class="c ${dt === maxDate ? 'max' : ''}" data-day="${dt}" style="background:${shade(v)};cursor:pointer;${dark ? 'color:#fff' : ''}"><div class="dn" style="${dark ? 'color:rgba(255,255,255,.85)' : ''}">${i + 1}</div><div class="dv">${v === null ? '' : fmtDur(v).replace(' min', 'm').replace(' h ', 'h ')}</div></div>`; }).join('')}
        </div></div>
      <div class="card"><h2>Tempo de tela por dia</h2><p class="hint">${fmtDate(first)} a ${fmtDate(last)}</p><div class="chartbox tall"><canvas id="cMonth"></canvas></div></div>
    </div>`;
  const set = (m) => { S.params.month = m; render(); };
  $('#bPrev').onclick = () => set(ymd(new Date(yy, mm - 2, 1)).slice(0, 7));
  $('#bNext').onclick = () => set(ymd(new Date(yy, mm, 1)).slice(0, 7));
  $$('[data-day]', body).forEach((c) => c.addEventListener('click', () => { S.params.tab = 'dia'; S.params.date = c.dataset.day; render(); }));
  chart($('#cMonth'), {
    type: 'bar',
    data: { labels: dates.map((dt) => Number(dt.slice(8))), datasets: [{ data: vals, backgroundColor: dates.map((dt) => (dt === maxDate ? G.g800 : G.g500)), borderRadius: 4 }] },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: minTicks }, x: { grid: { display: false } } }, plugins: { tooltip: tipDur } },
  });
}

async function tabQuest(body, d, today) {
  const qs = (await api.questionnaires({ from: '2000-01-01', to: today })).filter((q) => q.deviceId === d.deviceId);
  const tvMean = qs.length ? qs.reduce((s, q) => s + q.tvMin, 0) / qs.length : null;
  const pcMean = qs.length ? qs.reduce((s, q) => s + q.pcMin, 0) / qs.length : null;
  body.innerHTML = `
    <div class="grid g3">
      ${kpi('Questionários respondidos', qs.length, 'um por dia de referência (ontem)', true)}
      ${kpi('TV — média diária', durHtml(tvMean), qs.length ? `usou TV em ${qs.filter((q) => q.tv).length} de ${qs.length} dias` : '')}
      ${kpi('Computador — média diária', durHtml(pcMean), qs.length ? `usou computador em ${qs.filter((q) => q.pc).length} de ${qs.length} dias` : '')}
    </div>
    <div class="card mt"><h2>Respostas</h2><p class="hint">Pergunta diária: “Ontem, você usou TV? E computador? Por quanto tempo?”</p>
    ${qs.length ? `<table class="t"><thead><tr><th>Dia de referência</th><th>TV</th><th class="n">Tempo de TV</th><th>Computador</th><th class="n">Tempo de computador</th><th>Respondido em</th><th>Canal</th></tr></thead><tbody>
      ${qs.map((q) => `<tr><td class="strong">${fmtDateShort(q.refDate)}</td><td>${q.tv ? '<span class="chip g">Sim</span>' : '<span class="chip">Não</span>'}</td><td class="n">${q.tv ? fmtDur(q.tvMin) : '—'}</td>
        <td>${q.pc ? '<span class="chip g">Sim</span>' : '<span class="chip">Não</span>'}</td><td class="n">${q.pc ? fmtDur(q.pcMin) : '—'}</td><td>${new Date(q.answeredAt).toLocaleString('pt-BR')}</td><td>${channelChip(q.channel)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma resposta recebida.</div>'}</div>`;
}

async function tabQuality(body, d, today) {
  const days = await api.days({ deviceId: d.deviceId, from: addDays(today, -60), to: today });
  const hb = d.hb || {};
  const yes = (v) => (v === true ? '<span class="chip g">Sim</span>' : v === false ? '<span class="chip r">Não</span>' : '—');
  body.innerHTML = `
    <div class="grid g2">
      <div class="card"><h2>Estado do aparelho</h2><p class="hint">Último relatório enviado pelo app ${hb.receivedAt ? fmtAgo(hb.receivedAt) : ''}</p>
        <div class="stat-list">
          <span class="k">Acesso aos dados de uso (fonte principal)</span><span class="v">${yes(hb.usageAccess)}</span>
          <span class="k">Serviço em segundo plano ativo</span><span class="v">${yes(hb.serviceRunning)}</span>
          <span class="k">Isento da otimização de bateria</span><span class="v">${yes(hb.batteryOptIgnored)}</span>
          <span class="k">Notificações permitidas</span><span class="v">${yes(hb.notifPerm)}</span>
          <span class="k">Data/hora automática</span><span class="v">${yes(hb.autoTime)}</span>
          <span class="k">Usa bloqueio de tela</span><span class="v">${yes(hb.usesKeyguard)}</span>
          <span class="k">Fuso horário</span><span class="v">${esc(hb.tz || '—')}</span>
          <span class="k">Bateria</span><span class="v">${hb.battery !== undefined ? `${hb.battery}%` : '—'}</span>
        </div></div>
      <div class="card"><h2>Como ler esta tabela</h2><p class="hint" style="margin:0"><b>Completo</b>: o dia terminou e o registro do sistema cobre as 24 h. <b>Cobertura parcial</b>: o histórico do Android não alcançava o início do dia (ex.: app instalado depois). <b>Registro próprio</b>: medição independente feita pelo próprio app em tempo real (broadcasts de tela), usada como conferência cruzada — diferenças grandes indicam que o app ficou parado ou foi encerrado.</p></div>
    </div>
    <div class="card mt"><h2>Indicadores por dia</h2>
      ${days.length ? `<table class="t"><thead><tr><th>Dia</th><th class="n">Tempo de tela</th><th class="n">Registro próprio</th><th class="n">Diferença</th><th class="n">Desligado</th><th class="n">Sessões &gt; 4 h</th><th>Fonte</th><th>Algoritmo</th><th>Situação</th><th>Recebido</th></tr></thead><tbody>
      ${days.slice().reverse().map((x) => { const df = x.ownLogMin === null ? null : x.screenMin - x.ownLogMin; return `<tr><td class="strong">${fmtDateShort(x.date)}</td><td class="n">${fmtDur(x.screenMin)}</td>
        <td class="n">${x.ownLogMin === null ? '—' : fmtDur(x.ownLogMin)}</td><td class="n ${df === null ? '' : diffClass(df)}">${df === null ? '—' : fmtSigned(df)} ${df === null ? '' : 'min'}</td>
        <td class="n">${fmtDur(x.deviceOffMin, { zero: '—' })}</td><td class="n">${x.longSessions || '—'}</td><td>${x.source === 'ownlog' ? '<span class="chip a">Registro próprio</span>' : '<span class="chip g">Sistema</span>'}</td>
        <td class="mono muted">${esc(x.algo)}</td><td>${dayStatus(x, today)}</td><td>${fmtAgo(x.receivedAt)} ${channelChip(x.channel)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">Sem dados.</div>'}</div>`;
}

// ------------------------------------------------------------------ questionários (todos)
VIEWS.questionarios = async (el) => {
  const to = S.params.to || S.today; const from = S.params.from || addDays(S.today, -13);
  const qs = await api.questionnaires({ from, to });
  const devs = (await api.devices()).filter((d) => d.linked);
  const dates = []; for (let dt = to; dt >= from; dt = addDays(dt, -1)) dates.push(dt);
  const by = {}; qs.forEach((q) => { by[`${q.deviceId}|${q.refDate}`] = q; });
  el.innerHTML = `
    <div class="head"><div><h1>Questionários</h1><div class="sub">Uso de TV e computador relatado diariamente pelos participantes</div></div>
      <div class="actions"><input type="date" class="in" id="qFrom" value="${from}"><span class="muted">até</span><input type="date" class="in" id="qTo" value="${to}">
      <button class="btn" id="bQcsv">${ico('down')}Exportar CSV</button></div></div>
    <div class="card"><h2>Matriz de respostas</h2><p class="hint">Cada célula mostra o tempo de TV e de computador (PC) relatado para o dia de referência</p>
      ${devs.length ? `<div style="overflow:auto"><table class="t"><thead><tr><th>Participante</th>${dates.map((dt) => `<th>${fmtDateShort(dt)}</th>`).join('')}</tr></thead><tbody>
      ${devs.map((d) => `<tr><td class="strong">${esc(d.participant)}</td>${dates.map((dt) => { const q = by[`${d.deviceId}|${dt}`]; return `<td>${q ? `<div class="qm"><b>TV</b><span>${q.tv ? fmtDur(q.tvMin) : '<span class="muted">não usou</span>'}</span><b>PC</b><span>${q.pc ? fmtDur(q.pcMin) : '<span class="muted">não usou</span>'}</span></div>` : '<span class="muted">pendente</span>'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Nenhum aparelho vinculado.</div>'}
    </div>`;
  const upd = () => { S.params.from = $('#qFrom').value; S.params.to = $('#qTo').value; render(); };
  $('#qFrom').onchange = upd; $('#qTo').onchange = upd;
  $('#bQcsv').onclick = async () => { const r = await api.exportCsv({ kind: 'questionnaires', from, to }); if (r.ok) toast('Arquivo salvo'); };
};

// ------------------------------------------------------------------ validação (padrão-ouro)
VIEWS.validacao = async (el) => {
  const devs = (await api.devices()).filter((d) => d.linked);
  const sel = S.params.dev || (devs[0] && devs[0].deviceId);
  const exL = !!S.params.exL;
  const v = await api.validation({ excludeLauncher: exL });
  const days = sel ? await api.days({ deviceId: sel, from: addDays(S.today, -30), to: S.today }) : [];
  const st = v.stats;
  el.innerHTML = `
    <div class="head"><div><h1>Validação com o padrão-ouro</h1><div class="sub">Compare o tempo medido pelo IF Screen (X) com o tempo do Bem-estar Digital do próprio celular (Y)</div></div>
      <div class="actions"><button class="btn" id="bVcsv">${ico('down')}CSV</button><button class="btn p" id="bVpdf">${ico('print')}Relatório de teste (PDF)</button></div></div>
    <div class="banner g"><div class="bt">Como obter Y: no celular, abra <b>Configurações → Bem-estar digital e controle parental</b> (Samsung: <b>Bem-estar digital</b>), toque no gráfico e escolha o dia. Compare somente <b>dias completos</b> (ontem para trás). Digite como <b>3:42</b>, <b>3h42</b> ou <b>222</b> (minutos).</div></div>
    <div class="grid g21">
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
          <div><h2>Lançar valores do padrão-ouro</h2><p class="hint" style="margin:0">Últimos 30 dias do aparelho selecionado · salva automaticamente</p></div>
          <select class="in" id="vDev">${devs.map((d) => `<option value="${esc(d.deviceId)}" ${d.deviceId === sel ? 'selected' : ''}>${esc(d.participant)} · ${esc(d.code)}</option>`).join('')}</select></div>
        ${days.length ? `<table class="t"><thead><tr><th>Dia</th><th class="n">IF Screen (X)</th><th class="n">Sem tela inicial</th><th class="n">Bem-estar Digital (Y)</th><th class="n">X − Y</th><th>Situação</th></tr></thead><tbody>
        ${days.slice().reverse().map((x) => { const xv = Math.floor(x.screenMin - (exL ? x.launcherMin : 0)); const df = x.refMin === null ? null : xv - x.refMin; return `<tr>
          <td class="strong">${fmtDateShort(x.date)}</td><td class="n">${fmtDur(x.screenMin)}</td><td class="n muted">${fmtDur(x.screenMin - x.launcherMin)}</td>
          <td class="n"><input class="in ref" data-ref="${x.date}" value="${x.refMin === null ? '' : minToHM(x.refMin)}" placeholder="h:mm" ${x.date === S.today ? 'title="Dia em andamento: compare apenas dias completos"' : ''}></td>
          <td class="n ${df === null ? '' : diffClass(df)}">${df === null ? '—' : `${fmtSigned(df, 0)} min`}</td><td>${dayStatus(x, S.today)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">Sem dias para este aparelho.</div>'}
      </div>
      <div class="card"><h2>Concordância (todos os aparelhos)</h2><p class="hint">Dias completos com Y lançado · ${st.n} par(es), ${st.subjects || 0} aparelho(s)</p>
        <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="exL" ${exL ? 'checked' : ''}><span class="k"></span>Comparar sem a tela inicial</label>
        <div class="stat-list">
          <span class="k">Viés médio (X − Y)</span><span class="v">${st.n ? `${fmtSigned(st.bias, 2)} min` : '—'}</span>
          <span class="k">Limites de concordância 95%</span><span class="v">${st.n > 1 ? `${fmtNum(st.loaLow, 1)} a ${fmtNum(st.loaHigh, 1)} min` : '—'}</span>
          <span class="k">Erro absoluto médio</span><span class="v">${st.n ? `${fmtNum(st.mae, 2)} min` : '—'}</span>
          <span class="k">Maior diferença</span><span class="v">${st.n ? `${fmtNum(st.maxAbs, 0)} min` : '—'}</span>
          <span class="k">Dias com diferença ≤ 1 min</span><span class="v">${st.n ? `${fmtNum(st.within1, 0)}%` : '—'}</span>
          <span class="k">Dias com diferença ≤ 5 min</span><span class="v">${st.n ? `${fmtNum(st.within5, 0)}%` : '—'}</span>
          <span class="k">Dias com diferença ≤ 15 min</span><span class="v">${st.n ? `${fmtNum(st.within15, 0)}%` : '—'}</span>
          <span class="k">Correlação (Pearson)</span><span class="v">${fmtNum(st.pearson, 3)}</span>
          <span class="k">Correlação de medidas repetidas</span><span class="v">${fmtNum(st.rmcorr, 3)}</span>
        </div></div>
    </div>
    <div class="card mt"><h2>Gráfico de Bland-Altman</h2><p class="hint">Cada ponto é um dia de um aparelho: média de X e Y (horizontal) contra a diferença X − Y (vertical). Linha verde: viés; tracejadas: limites de 95%</p><div class="chartbox tall"><canvas id="cBA"></canvas></div></div>`;
  $('#vDev') && ($('#vDev').onchange = (e) => { S.params.dev = e.target.value; render(); });
  $('#exL').onchange = (e) => { S.params.exL = e.target.checked; render(); };
  $$('[data-ref]', el).forEach((i) => i.addEventListener('change', async () => {
    const m = parseRef(i.value);
    if (Number.isNaN(m)) { toast('Formato inválido. Use 3:42, 3h42 ou minutos.', true); return; }
    const r = await api.setReference({ deviceId: sel, date: i.dataset.ref, minutes: m });
    if (r.ok) render(); else toast(r.error || 'Erro', true);
  }));
  $('#bVcsv').onclick = async () => { const r = await api.exportCsv({ kind: 'validation' }); if (r.ok) toast('Arquivo salvo'); };
  $('#bVpdf').onclick = () => printReport('teste');
  baChart($('#cBA'), v.pairs.filter((p) => p.complete), st);
};

function baChart(canvas, pairs, st) {
  const pts = pairs.map((p) => ({ x: (p.x + p.y) / 2, y: p.x - p.y, label: `${p.subject} ${fmtDate(p.date)}` }));
  const xs = pts.map((p) => p.x); const x0 = xs.length ? Math.min(...xs) : 0; const x1 = xs.length ? Math.max(...xs) : 600;
  const line = (y, color, dash) => ({ type: 'line', data: [{ x: x0, y }, { x: x1, y }], borderColor: color, borderWidth: 2, borderDash: dash, pointRadius: 0 });
  const ds = [{ type: 'scatter', data: pts, backgroundColor: 'rgba(47,158,65,.75)', pointRadius: 5 }];
  if (st.n) ds.push(line(st.bias, G.g700, []));
  if (st.n > 1) { ds.push(line(st.loaLow, G.amber, [6, 5])); ds.push(line(st.loaHigh, G.amber, [6, 5])); }
  ds.push(line(0, '#B9C4BC', [2, 3]));
  return chart(canvas, {
    type: 'scatter', data: { datasets: ds },
    options: {
      maintainAspectRatio: false, animation: false,
      scales: { x: { title: { display: true, text: 'Média de X e Y (min/dia)' } }, y: { title: { display: true, text: 'Diferença X − Y (min)' }, suggestedMin: -5, suggestedMax: 5 } },
      plugins: { tooltip: { callbacks: { label: (c) => (c.raw.label ? ` ${c.raw.label}: ${fmtSigned(c.raw.y, 1)} min` : '') } } },
    },
  });
}

// ------------------------------------------------------------------ relatórios
VIEWS.relatorios = async (el) => {
  const from = S.params.from || addDays(S.today, -6); const to = S.params.to || S.today;
  el.innerHTML = `
    <div class="head"><div><h1>Relatórios</h1><div class="sub">PDF para leitura e CSV (Excel) para análise estatística</div></div>
      <div class="actions"><input type="date" class="in" id="rFrom" value="${from}"><span class="muted">até</span><input type="date" class="in" id="rTo" value="${to}"></div></div>
    <div class="grid g3">
      <div class="card"><h2>Relatório de teste e avaliação</h2><p class="hint">Compara, dia a dia, o tempo medido pelo IF Screen (X) com o Bem-estar Digital (Y) lançado na tela Validação. Traz viés, limites de concordância e o gráfico de Bland-Altman.</p><button class="btn p" data-rep="teste">${ico('print')}Gerar PDF</button></div>
      <div class="card"><h2>Ficha de teste em branco</h2><p class="hint">Formulário para anotar à mão, em cada dia de teste, o valor do IF Screen e do padrão-ouro de cada celular.</p><button class="btn" data-rep="ficha">${ico('print')}Gerar PDF</button></div>
      <div class="card"><h2>Relatório do estudo</h2><p class="hint">Tempo de tela diário de todos os aparelhos no período escolhido, com médias, dia de maior uso e questionários.</p><button class="btn" data-rep="estudo">${ico('print')}Gerar PDF</button></div>
    </div>
    <div class="card mt"><h2>Exportar dados (CSV para Excel, R, SPSS, Stata)</h2><p class="hint">Separador “;” e vírgula decimal. Período: ${fmtDate(from)} a ${fmtDate(to)}</p>
      <div class="actions">
        <button class="btn" data-csv="days">${ico('down')}Tempo de tela diário</button>
        <button class="btn" data-csv="sessions">${ico('down')}Sessões (início/fim)</button>
        <button class="btn" data-csv="questionnaires">${ico('down')}Questionários</button>
        <button class="btn" data-csv="validation">${ico('down')}Validação (X vs Y)</button>
      </div></div>`;
  const upd = () => { S.params.from = $('#rFrom').value; S.params.to = $('#rTo').value; render(); };
  $('#rFrom').onchange = upd; $('#rTo').onchange = upd;
  $$('[data-csv]', el).forEach((b) => b.addEventListener('click', async () => { const r = await api.exportCsv({ kind: b.dataset.csv, from, to }); if (r.ok) toast('Arquivo salvo'); }));
  $$('[data-rep]', el).forEach((b) => b.addEventListener('click', () => printReport(b.dataset.rep, { from, to })));
};

async function printReport(type, { from, to } = {}) {
  const root = $('#print-root');
  const inst = S.logo ? `<img src="${S.logo}">` : `<b style="margin-left:auto;color:${G.g700}">${esc(S.settings.institution || 'IFRN')}</b>`;
  const header = (title, sub) => `<div class="rh">${LOGO_SVG}<div><h1>${title}</h1><div class="meta">${sub}</div></div>${inst}</div>`;
  const foot = `<div class="foot">IF Screen · ${esc(S.settings.centralName)} · gerado em ${new Date().toLocaleString('pt-BR')} · algoritmo ifs-unlock-1 (desbloqueio → tela apagada/bloqueio)</div>`;
  let html = ''; let after = null;
  if (type === 'teste') {
    const v = await api.validation({});
    const vL = await api.validation({ excludeLauncher: true });
    const st = v.stats; const stL = vL.stats;
    const verdict = !st.n ? ['Nenhum par lançado ainda.', '#eee']
      : Math.abs(st.bias) <= 1 && st.loaHigh <= 5 && st.loaLow >= -5 ? ['Concordância excelente: diferença média ≤ 1 min e 95% dos dias dentro de ±5 min.', G.g100]
        : st.loaHigh <= 15 && st.loaLow >= -15 ? ['Concordância aceitável: 95% dos dias dentro de ±15 min (referência de Kristensen et al., 2022).', '#FFF5E0']
          : ['Concordância abaixo do esperado: revisar aparelhos com maiores diferenças (ver tabela).', '#FDECEC'];
    const rows = v.pairs.map((p) => {
      const pl = vL.pairs.find((q) => q.deviceId === p.deviceId && q.date === p.date);
      return `<tr><td>${esc(p.subject)}</td><td>${fmtDateShort(p.date)}</td><td class="n">${fmtDur(p.x)}</td><td class="n">${fmtDur(p.y)}</td>
      <td class="n ${diffClass(p.diff)}">${fmtSigned(p.diff, 0)}</td><td class="n">${p.y ? fmtSigned(p.diff / p.y * 100, 1) + '%' : '—'}</td>
      <td class="n">${pl ? fmtSigned(pl.diff, 0) : '—'}</td><td>${p.complete ? 'Completo' : 'Incompleto*'}</td><td>${Math.abs(p.diff) <= 1 ? '✓ confere' : Math.abs(p.diff) <= 5 ? '≈ próximo' : '✗ divergente'}</td></tr>`;
    }).join('');
    html = `<div class="rep">${header('Relatório de teste e avaliação', 'IF Screen (X) × Bem-estar Digital do Android — padrão-ouro (Y)')}
      <h2>Resumo da concordância (dias completos)</h2>
      <div class="kp"><div>Pares analisados<b>${st.n || 0}</b>${st.subjects || 0} aparelho(s)</div><div>Viés médio (X − Y)<b>${st.n ? fmtSigned(st.bias, 2) + ' min' : '—'}</b>IC95% ${st.n > 1 ? `${fmtNum(st.biasCiLow, 2)} a ${fmtNum(st.biasCiHigh, 2)}` : '—'}</div>
      <div>Limites de concordância 95%<b>${st.n > 1 ? `${fmtNum(st.loaLow, 1)} a ${fmtNum(st.loaHigh, 1)}` : '—'}</b>minutos/dia</div><div>Erro absoluto médio<b>${st.n ? fmtNum(st.mae, 2) + ' min' : '—'}</b>maior: ${st.n ? fmtNum(st.maxAbs, 0) : '—'} min</div>
      <div>Dias com |X − Y| ≤ 1 min<b>${st.n ? fmtNum(st.within1, 0) + '%' : '—'}</b></div><div>Dias com |X − Y| ≤ 5 min<b>${st.n ? fmtNum(st.within5, 0) + '%' : '—'}</b></div>
      <div>Correlação de Pearson<b>${fmtNum(st.pearson, 3)}</b></div><div>Correlação de medidas repetidas<b>${fmtNum(st.rmcorr, 3)}</b></div></div>
      <div class="verdict" style="background:${verdict[1]}">${verdict[0]}</div>
      <p class="meta">Variante sem a tela inicial: viés ${stL.n ? fmtSigned(stL.bias, 2) : '—'} min; limites ${stL.n > 1 ? `${fmtNum(stL.loaLow, 1)} a ${fmtNum(stL.loaHigh, 1)}` : '—'} min. Use esta variante caso o padrão-ouro do modelo testado não conte a tela inicial.</p>
      <h2>Gráfico de Bland-Altman</h2><div class="chartbox"><canvas id="pBA"></canvas></div>
      <h2>Comparação dia a dia</h2>
      <table><thead><tr><th>Participante</th><th>Dia</th><th class="n">IF Screen (X)</th><th class="n">Padrão-ouro (Y)</th><th class="n">X − Y (min)</th><th class="n">%</th><th class="n">X − Y sem tela inicial</th><th>Dia</th><th>Resultado</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Lance valores na tela Validação.</td></tr>'}</tbody></table>
      <p class="meta">* Dias incompletos aparecem na tabela, mas não entram nas estatísticas. Valores exibidos truncados ao minuto, como no Bem-estar Digital. Limites de Bland-Altman para medidas repetidas (Bland & Altman, 2007).</p>${foot}</div>`;
    after = () => baChart($('#pBA'), v.pairs.filter((p) => p.complete), st);
  } else if (type === 'ficha') {
    const devs = (await api.devices()).filter((d) => d.linked);
    const lines = (devs.length ? devs : [...Array(10)].map(() => ({})));
    const dates = [...Array(7)].map((_, i) => addDays(S.today, i));
    html = `<div class="rep">${header('Ficha de teste — IF Screen × padrão-ouro', 'Preencha uma linha por celular por dia. Compare sempre o dia ANTERIOR completo.')}
      <p class="meta">Procedimento: (1) no celular, abra o IF Screen → “Minhas medições” e anote o tempo de ontem (X); (2) abra Configurações → Bem-estar digital, escolha o mesmo dia e anote (Y); (3) calcule X − Y. Diferenças até ±1 min são esperadas (arredondamento).</p>
      ${dates.map((dt, k) => `<h2${k && k % 2 === 0 ? ' class="pb"' : ''}>Dia de leitura ${fmtDate(dt)} — dia comparado ${fmtDate(addDays(dt, -1))}</h2>
      <table><thead><tr><th>Participante / código</th><th>Modelo</th><th class="n" style="width:15%">IF Screen (X)</th><th class="n" style="width:15%">Bem-estar Digital (Y)</th><th class="n" style="width:11%">X − Y</th><th style="width:22%">Observações</th></tr></thead>
      <tbody>${lines.map((d) => `<tr style="height:26px"><td>${esc(d.participant || '')} ${d.code ? `<span class="mono">${esc(d.code)}</span>` : ''}</td><td>${esc(d.info ? [d.info.manufacturer, d.info.model].filter(Boolean).join(' ') : '')}</td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>`).join('')}
      ${foot}</div>`;
  } else {
    const devs = (await api.devices()).filter((d) => d.linked);
    const dates = []; for (let dt = from; dt <= to; dt = addDays(dt, 1)) dates.push(dt);
    const qs = await api.questionnaires({ from, to });
    const blocks = [];
    for (const d of devs) {
      const days = await api.days({ deviceId: d.deviceId, from, to });
      const by = Object.fromEntries(days.map((x) => [x.date, x]));
      const comp = days.filter((x) => x.complete);
      const mean = comp.length ? comp.reduce((s, x) => s + x.screenMin, 0) / comp.length : null;
      const max = days.reduce((m, x) => (!m || x.screenMin > m.screenMin ? x : m), null);
      const dq = qs.filter((q) => q.deviceId === d.deviceId);
      blocks.push({ d, by, mean, max, n: comp.length, tv: dq.length ? dq.reduce((s, q) => s + q.tvMin, 0) / dq.length : null, pc: dq.length ? dq.reduce((s, q) => s + q.pcMin, 0) / dq.length : null, nq: dq.length });
    }
    html = `<div class="rep">${header('Relatório do estudo', `Tempo de tela do smartphone · ${fmtDate(from)} a ${fmtDate(to)} · ${devs.length} aparelho(s)`)}
      <h2>Resumo por participante</h2>
      <table><thead><tr><th>Participante</th><th>Código</th><th class="n">Dias completos</th><th class="n">Média diária</th><th>Dia de maior uso</th><th class="n">TV (média)</th><th class="n">Computador (média)</th><th class="n">Questionários</th></tr></thead><tbody>
      ${blocks.map((b) => `<tr><td><b>${esc(b.d.participant)}</b></td><td class="mono">${esc(b.d.code)}</td><td class="n">${b.n}</td><td class="n"><b>${fmtDur(b.mean)}</b></td><td>${b.max ? `${fmtDateShort(b.max.date)} · ${fmtDur(b.max.screenMin)}` : '—'}</td><td class="n">${fmtDur(b.tv)}</td><td class="n">${fmtDur(b.pc)}</td><td class="n">${b.nq}</td></tr>`).join('')}</tbody></table>
      <h2>Tempo de tela diário (h:min)</h2>
      <table><thead><tr><th>Participante</th>${dates.map((dt) => `<th class="n">${fmtDateShort(dt)}</th>`).join('')}</tr></thead><tbody>
      ${blocks.map((b) => `<tr><td><b>${esc(b.d.participant)}</b></td>${dates.map((dt) => { const x = b.by[dt]; return `<td class="n">${x ? `${minToHM(Math.floor(x.screenMin))}${x.complete ? '' : '*'}` : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
      <p class="meta">* dia incompleto (em andamento ou cobertura parcial). Médias consideram apenas dias completos.</p>
      <h2>Média do grupo por dia</h2><div class="chartbox"><canvas id="pGroup"></canvas></div>${foot}</div>`;
    after = () => {
      const means = dates.map((dt) => { const v = blocks.map((b) => b.by[dt]).filter(Boolean).map((x) => x.screenMin); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; });
      chart($('#pGroup'), { type: 'bar', data: { labels: dates.map(fmtDateShort), datasets: [{ data: means, backgroundColor: G.g600, borderRadius: 4 }] }, options: { animation: false, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: minTicks } } } });
    };
  }
  root.innerHTML = html;
  document.body.classList.add('printing');
  if (after) after();
  await new Promise((r) => setTimeout(r, 400));
  const names = { teste: 'relatorio-teste-ifscreen.pdf', ficha: 'ficha-de-teste-ifscreen.pdf', estudo: 'relatorio-estudo-ifscreen.pdf' };
  try { const r = await api.printPdf({ filename: names[type] }); if (r && r.ok) toast('PDF salvo'); }
  finally { document.body.classList.remove('printing'); root.innerHTML = ''; }
}

// ------------------------------------------------------------------ protocolo
VIEWS.protocolo = async (el) => {
  const r = (a, b, c) => `<tr><td>${a}</td><td class="${b === 'Conta' ? 'yes' : 'no'}">${b}</td><td>${c}</td></tr>`;
  el.innerHTML = `
    <div class="head"><div><h1>Protocolo de medição</h1><div class="sub">O que o IF Screen conta e o que descarta — algoritmo ifs-unlock-1</div></div></div>
    <div class="banner g"><div class="bt"><b>Definição operacional.</b> Tempo de tela = soma dos intervalos em que o celular está <b>desbloqueado e com a tela ligada</b>. Cada sessão começa no desbloqueio e termina quando a tela apaga ou o aparelho bloqueia. Sessões que cruzam a meia-noite são divididas entre os dias.</div></div>
    <div class="card"><h2>Situações e decisão</h2>
      <table class="t protocol"><thead><tr><th>Situação</th><th>Decisão</th><th>Justificativa</th></tr></thead><tbody>
      ${r('Uso de apps após desbloquear (inclui ligações, vídeo, jogos, o próprio IF Screen)', 'Conta', 'É o comportamento-alvo; coincide com o que o padrão-ouro registra como uso')}
      ${r('Tela inicial (launcher) após desbloquear', 'Conta', 'Faz parte do tempo desbloqueado. É medida à parte (“sem tela inicial”) para a análise de sensibilidade')}
      ${r('Aparelho sem senha/bloqueio: tela ligada', 'Conta', 'Sem bloqueio, tela ligada = aparelho em uso')}
      ${r('Notificação que acende a tela sem desbloqueio', 'Descarta', 'Não há interação; o artigo de referência filtrava isso depois, aqui é descartado na origem')}
      ${r('Tela de bloqueio, Always-On Display, relógio/widgets do bloqueio', 'Descarta', 'Aparelho bloqueado')}
      ${r('Tempo digitando PIN/padrão ou aguardando biometria', 'Descarta', 'A contagem começa no desbloqueio efetivo')}
      ${r('Ligação ou música com a tela apagada (sensor de proximidade, bolso)', 'Descarta', 'Tela desligada')}
      ${r('Aparelho desligado / sem bateria', 'Descarta', 'Registrado à parte como “tempo desligado” (indicador de qualidade)')}
      ${r('Sessão contínua acima de 4 h', 'Conta', 'Mantida (pode ser vídeo longo) e sinalizada para inspeção — não é apagada automaticamente')}
      </tbody></table></div>
    <div class="grid g2 mt">
      <div class="card"><h2>Fontes de dados (coleta independente)</h2><p class="hint" style="margin:0">
        <b>1. Registro de eventos do sistema</b> (UsageStatsManager: tela ligada/desligada, bloqueio exibido/oculto, desligamento). O próprio Android grava esses eventos mesmo que o app seja encerrado; o IF Screen os lê e calcula o tempo com o seu algoritmo — <b>não copia</b> números do Bem-estar Digital.<br><br>
        <b>2. Registro próprio em tempo real</b> (broadcasts de tela ligada, desligada e desbloqueio, gravados pelo serviço do app). Serve como conferência cruzada e como reserva se o acesso aos dados de uso for retirado.</p></div>
      <div class="card"><h2>Dia válido e análise</h2><p class="hint" style="margin:0">
        Um dia entra nas médias quando está <b>completo</b>: terminou e o registro cobre de 00:00 a 23:59. O dia em andamento e dias com cobertura parcial aparecem, mas são marcados.<br><br>
        A concordância com o padrão-ouro é avaliada por <b>Bland-Altman para medidas repetidas</b> (viés e limites de 95%), erro absoluto médio e correlação de medidas repetidas, seguindo Kristensen et al. (2022) e a terminologia COSMIN (validade de critério).</p></div>
    </div>`;
};

// ------------------------------------------------------------------ saber mais
function securityChecks(s, st, devs) {
  const out = [];
  const add = (level, title, text) => out.push({ level, title, text });
  // chaves
  if (s.relayEnabled === 'true') {
    if (!s.centralKey) add('r', 'CENTRAL_KEY vazia', 'Defina uma chave longa no Railway e cole-a em Configurações → Nuvem.');
    else if (s.centralKey.length < 20) add('a', 'CENTRAL_KEY curta', `Tem ${s.centralKey.length} caracteres. Use 20 ou mais, com letras e números aleatórios.`);
    else add('g', 'CENTRAL_KEY forte', `${s.centralKey.length} caracteres. Só a Central consegue ler os dados da ponte.`);
    if (/^https:\/\//i.test(s.relayUrl || '')) add('g', 'Nuvem criptografada', 'O endereço do Railway usa HTTPS: os dados viajam criptografados.');
    else add('r', 'Nuvem sem HTTPS', 'O endereço da ponte deve começar com https://.');
  } else add('b', 'Nuvem desativada', 'Só a rede local está em uso. Nenhum dado passa pela internet.');
  if ((s.appKey || '') === 'ifscreen-app-key') add('a', 'APP_KEY padrão', 'A chave do app é a padrão do projeto, que aparece na documentação. Para a coleta oficial, troque-a no Railway e aqui, e gere o APK de novo com a nova chave.');
  else add('g', 'APP_KEY própria', 'Só o app gerado com esta chave consegue cadastrar aparelhos.');
  add('b', 'Rede local sem criptografia', 'Na rede local os dados viajam por HTTP. Use só a rede Wi-Fi da pesquisa, protegida por senha (WPA2 ou WPA3).');
  // minimização: participantes identificados por código
  const named = devs.filter((d) => d.linked && d.participant && !/^[A-Za-z]{0,4}[-_ ]?\d{1,6}$/.test(d.participant.trim()));
  if (named.length) add('a', `${named.length} participante(s) com identificação fora do padrão`, `Ex.: “${esc(named[0].participant)}”. Use códigos como P001 em vez de nomes, para não guardar dados pessoais desnecessários.`);
  else add('g', 'Participantes pseudonimizados', 'Todos os vinculados estão identificados por código.');
  if (s.showScreenTime === 'true') add('a', 'Modo teste ligado', 'O participante vê o próprio tempo medido. Desligue em Configurações antes da coleta oficial.');
  add('b', 'Dados guardados neste computador', `${esc(st.dataDir)} · cópias de segurança automáticas dos últimos 14 dias. Proteja a conta do Windows com senha e, se possível, ative a criptografia do disco (BitLocker).`);
  return out;
}

VIEWS.saber = async (el) => {
  const s = await api.settings(); S.settings = s;
  const st = await api.status();
  const devs = await api.devices();
  const checks = securityChecks(s, st, devs);
  const lv = { g: ['g', 'OK'], a: ['a', 'Atenção'], r: ['r', 'Corrigir'], b: ['b', 'Informação'] };
  const li = (a) => `<ul class="lst">${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  el.innerHTML = `
    <div class="head"><div><h1>Saber mais</h1><div class="sub">O projeto, a vantagem sobre o padrão-ouro, a LGPD e a segurança do IF Screen</div></div></div>
    <div class="grid g21">
      <div class="card info"><h2>Sobre o projeto</h2>
        <p>O <b>IF Screen</b> mede, de forma objetiva e remota, o tempo de tela de smartphones Android. Ele foi desenvolvido por <b>Daniel Reginaldo da Silva</b>, estudante do Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas do IFRN, para o projeto de pesquisa <b>“Associação entre aptidão física e desempenho cognitivo e acadêmico em adolescentes da rede federal de ensino”</b>, coordenado pelo <b>Prof. Rodrigo Ramalho Aniceto</b>.</p>
        <p>O objetivo é fornecer ao estudo uma medida confiável da exposição a telas no dia a dia, para analisar a sua relação com o desempenho acadêmico.</p></div>
      <div class="card info"><h2>Em uma frase</h2><p>Conta o tempo em que o celular está <b>desbloqueado e com a tela ligada</b>, calcula tudo no próprio aparelho e envia só os totais e os horários das sessões — sem prints, sem conteúdo, sem nomes de aplicativos.</p>
        <p class="muted" style="margin:0">Detalhes do algoritmo em <a data-go="protocolo">Protocolo de medição</a>.</p></div>
    </div>

    <div class="card mt"><h2>Vantagem em relação ao padrão-ouro</h2><p class="hint">O padrão-ouro é o Bem-estar Digital do próprio Android. Ele mede bem, mas não foi feito para pesquisa: o pesquisador precisa ver o celular ou pedir prints ao participante.</p>
      <table class="t protocol"><thead><tr><th>Aspecto</th><th>Bem-estar Digital (prints)</th><th>IF Screen</th></tr></thead><tbody>
        <tr><td>Como os dados chegam</td><td>O participante tira prints e envia, ou o pesquisador anota olhando o celular</td><td class="yes">Automático e remoto, pela rede da escola ou pela internet</td></tr>
        <tr><td>Esforço do participante</td><td>Diário, depende de lembrar e enviar</td><td class="yes">Nenhum: só o questionário de 20 segundos</td></tr>
        <tr><td>Histórico</td><td>Cerca de uma semana; o que não foi anotado se perde</td><td class="yes">Guardado no celular até a Central confirmar</td></tr>
        <tr><td>Erros de transcrição</td><td>Possíveis (leitura e digitação dos prints)</td><td class="yes">Nenhum: números calculados e transmitidos</td></tr>
        <tr><td>Detalhe</td><td>Total do dia</td><td class="yes">Cada sessão (início e fim), por hora e por dia</td></tr>
        <tr><td>Acompanhamento</td><td>Só quando o participante envia</td><td class="yes">Em tempo real, com alertas de falha</td></tr>
        <tr><td>Privacidade</td><td>O print mostra os aplicativos usados e passa por apps de mensagem</td><td class="yes">Só horários e totais; canal criptografado</td></tr>
      </tbody></table></div>

    <div class="card mt"><div class="row" style="justify-content:space-between;align-items:center"><div><h2>Verificação de segurança desta Central</h2><p class="hint" style="margin:0">Calculada agora, a partir das configurações e dos aparelhos</p></div>
      <span class="chip ${checks.some((c) => c.level === 'r') ? 'r' : checks.some((c) => c.level === 'a') ? 'a' : 'g'}">${checks.filter((c) => c.level === 'g').length} OK · ${checks.filter((c) => c.level === 'a' || c.level === 'r').length} a revisar</span></div>
      <div class="sec-list mt">${checks.map((c) => `<div class="sec ${c.level}"><span class="chip ${lv[c.level][0]}">${lv[c.level][1]}</span><div><b>${c.title}</b><div class="muted">${c.text}</div></div></div>`).join('')}</div></div>

    <div class="grid g2 mt">
      <div class="card info"><h2>O que é coletado</h2>${li([
        '<b>Sessões de uso:</b> horário de início (desbloqueio) e de fim (tela apagada ou bloqueio) de cada sessão.',
        '<b>Totais por dia:</b> tempo de tela, tempo na tela inicial, tempo desligado e indicadores de qualidade.',
        '<b>Questionário diário:</b> se assistiu TV e se usou computador ou notebook, e por quanto tempo.',
        '<b>Dados técnicos:</b> fabricante, modelo e versão do Android, versão do app, permissões e otimização de bateria.',
        '<b>Identificação:</b> código do aparelho (IFS-XXXX-XXXX) e o código do participante dado pela equipe.'])}</div>
      <div class="card info"><h2>O que nunca é coletado</h2>${li([
        'Nomes dos aplicativos usados, sites visitados ou buscas.',
        'Mensagens, conversas, e-mails, fotos, vídeos, áudio ou câmera.',
        'Contatos, senhas, localização ou o conteúdo da tela.',
        'Nome do participante: a equipe usa um código (P001).'])}
        <p class="muted" style="margin:10px 0 0">Para separar o tempo na tela inicial, o app verifica dentro do próprio celular se ela está aberta. Essa verificação não sai do aparelho.</p></div>
    </div>

    <div class="grid g2 mt">
      <div class="card info"><h2>LGPD — base legal e ética</h2>${li([
        '<b>Lei nº 13.709/2018 (LGPD).</b> O IFRN é órgão de pesquisa (art. 5º, XVIII). O tratamento se apoia na realização de estudos por órgão de pesquisa (art. 7º, IV), com anonimização sempre que possível na divulgação.',
        '<b>Adolescentes (art. 14).</b> O tratamento deve atender ao melhor interesse do adolescente. A ANPD admite as bases dos arts. 7º e 11 nesse caso (Enunciado CD/ANPD nº 1/2023).',
        '<b>Ética em pesquisa.</b> Coleta só depois da aprovação do Comitê de Ética em Pesquisa (Resoluções CNS nº 466/2012 e nº 510/2016), com o Termo de Consentimento (TCLE) assinado pelo responsável e o Termo de Assentimento (TALE) pelo adolescente.',
        '<b>Necessidade (art. 6º, III).</b> Só o tempo de tela e o questionário: o mínimo para responder à pergunta da pesquisa.'])}</div>
      <div class="card info"><h2>Direitos do participante (art. 18) e como atender</h2>${li([
        '<b>Confirmação e acesso:</b> abra o aparelho em Aparelhos e mostre ou exporte os dados (Relatórios → CSV).',
        '<b>Correção:</b> o tempo é medido; as respostas do questionário podem ser corrigidas pelo próprio participante até o fim do dia seguinte.',
        '<b>Eliminação e revogação do consentimento:</b> Aparelhos → <b>Excluir dados</b>. Apaga tudo na Central, avisa a ponte e recusa novos envios do aparelho.',
        '<b>Informação:</b> o app tem a tela “Saber mais”, com o que é e o que não é coletado.',
        '<b>Incidente de segurança (art. 48):</b> comunique o coordenador da pesquisa, o CEP e, se houver risco aos participantes, a ANPD e os próprios titulares.'])}</div>
    </div>

    <div class="grid g2 mt">
      <div class="card info"><h2>Como o sistema protege os dados</h2>${li([
        'Cada celular cria uma chave secreta própria (256 bits). A Central e a ponte guardam só o resumo criptográfico (SHA-256) e comparam em tempo constante.',
        'A ponte só aceita cadastro com a <b>APP_KEY</b> e só entrega dados à Central com a <b>CENTRAL_KEY</b>.',
        'Na internet, o tráfego usa HTTPS. A ponte limita requisições por endereço e o tamanho de cada envio.',
        'A ponte é só uma caixa postal: apaga o conteúdo confirmado pela Central após 2 dias e não grava em disco sem um volume configurado.',
        'A interface da Central roda isolada (sandbox, isolamento de contexto e política de conteúdo restritiva).',
        'Excluir dados apaga o participante na Central e na ponte e bloqueia o aparelho.'])}</div>
      <div class="card info"><h2>Boas práticas da equipe</h2>${li([
        'Proteja a conta do Windows com senha e bloqueie a tela ao sair.',
        'Ative o BitLocker (criptografia do disco) no computador da Central.',
        'Não compartilhe a CENTRAL_KEY; troque a APP_KEY padrão antes da coleta oficial.',
        'Use uma rede Wi-Fi da pesquisa com senha; evite redes abertas.',
        'Guarde as exportações (CSV e PDF) em pasta protegida e apague cópias soltas.',
        'Ao terminar o estudo, exporte os dados, exclua o serviço no Railway e mantenha a base só pelo prazo aprovado pelo CEP.'])}</div>
    </div>

    <div class="card mt"><h2>Referências</h2><p class="hint" style="margin:0;line-height:1.7">
      BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais (LGPD).<br>
      AUTORIDADE NACIONAL DE PROTEÇÃO DE DADOS. Enunciado CD/ANPD nº 1, de 22 de maio de 2023.<br>
      CONSELHO NACIONAL DE SAÚDE. Resolução nº 466, de 12 de dezembro de 2012; Resolução nº 510, de 7 de abril de 2016.<br>
      KRISTENSEN, P. L. et al. Criterion validity of a research-based application for tracking screen time on android and iOS smartphones and tablets. Computers in Human Behavior Reports, v. 5, 100164, 2022.<br>
      OHME, J. et al. Mobile data donations: assessing self-report accuracy and sample biases with the iOS Screen Time function. Mobile Media &amp; Communication, v. 9, n. 2, p. 293-313, 2021.</p></div>
    <p class="muted" style="text-align:center;margin:18px 0 4px">IF Screen Central ${esc(st.version)} · IFRN</p>`;
  $$('[data-go]', el).forEach((a) => a.addEventListener('click', () => go(a.dataset.go)));
};

// ------------------------------------------------------------------ configurações
VIEWS.config = async (el) => {
  const s = await api.settings(); S.settings = s;
  const st = await api.status();
  const logs = await api.logs();
  el.innerHTML = `
    <div class="head"><div><h1>Configurações</h1><div class="sub">Conexões, estudo e identidade visual</div></div><div class="actions"><button class="btn p" id="bSave">Salvar alterações</button></div></div>
    <div class="grid g2">
      <div class="card"><h2>Rede local (in loco)</h2><p class="hint">Celulares no mesmo Wi-Fi encontram a Central automaticamente. Se não encontrarem, digite no app um dos endereços abaixo.</p>
        <div class="stat-list" style="margin-bottom:14px"><span class="k">Situação</span><span class="v">${st.localPort ? '<span class="chip g">Ativa</span>' : `<span class="chip r">${esc(st.localError || 'Parada')}</span>`}</span>
          <span class="k">Endereço(s)</span><span class="v mono">${(st.ips || []).map((i) => `${i.address}:${st.localPort || s.localPort}`).join('<br>') || 'sem rede'}</span></div>
        <div class="field"><label>Porta</label><input class="in" id="localPort" value="${esc(s.localPort)}" style="max-width:120px"><span class="help">Padrão 8787. O instalador libera esta porta no Firewall do Windows.</span></div>
      </div>
      <div class="card"><h2>Nuvem (Railway)</h2><p class="hint">Para celulares fora da rede da Central. Veja no manual como criar o servidor-ponte gratuito.</p>
        <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="relayEnabled" ${s.relayEnabled === 'true' ? 'checked' : ''}><span class="k"></span>Usar servidor-ponte na nuvem</label>
        <div class="field"><label>Endereço do servidor</label><input class="in" id="relayUrl" value="${esc(s.relayUrl)}" placeholder="https://ifscreen-relay-production.up.railway.app"></div>
        <div class="row mt"><div class="field" style="flex:1"><label>Chave da Central (CENTRAL_KEY)</label><input class="in" id="centralKey" type="password" value="${esc(s.centralKey)}"></div>
          <div class="field" style="flex:1"><label>Chave do app (APP_KEY)</label><input class="in" id="appKey" value="${esc(s.appKey)}"></div></div>
        <div class="row mt"><button class="btn" id="bTest">Testar conexão</button><span id="testMsg" class="muted"></span></div>
      </div>
      <div class="card"><h2>Estudo</h2><p class="hint">Enviado automaticamente a todos os celulares na próxima sincronização</p>
        <div class="row"><div class="field"><label>Notificação do questionário</label><select class="in" id="questionHour">${hours(s.questionHour)}</select></div>
          <div class="field"><label>Lembrete se não responder</label><select class="in" id="reminderHour">${hours(s.reminderHour)}</select></div>
          <div class="field"><label>Duração do estudo (dias)</label><input class="in" id="studyDays" value="${esc(s.studyDays)}" style="max-width:90px"></div></div>
        <label class="switch mt"><input type="checkbox" id="showScreenTime" ${s.showScreenTime === 'true' ? 'checked' : ''}><span class="k"></span><span><b>Modo teste</b> — mostrar ao participante o tempo medido (para comparar com o Bem-estar Digital)</span></label>
      </div>
      <div class="card"><h2>Identidade</h2><p class="hint">Nome exibido nos relatórios e no app; logomarca oficial da instituição (arquivo PNG/SVG fornecido pela instituição)</p>
        <div class="row"><div class="field" style="flex:1"><label>Instituição</label><input class="in" id="institution" value="${esc(s.institution)}"></div><div class="field" style="flex:1"><label>Nome da Central</label><input class="in" id="centralName" value="${esc(s.centralName)}"></div></div>
        <div class="row mt" style="align-items:center">${S.logo ? `<img src="${S.logo}" style="max-height:44px">` : '<span class="muted">Sem logomarca</span>'}<button class="btn sm" id="bLogo">Escolher arquivo…</button>${S.logo ? '<button class="btn sm ghost danger" id="bLogoRm">Remover</button>' : ''}</div>
      </div>
    </div>
    <div class="card mt"><div class="row" style="justify-content:space-between;align-items:center"><div><h2>Dados e diagnóstico</h2><p class="hint" style="margin:0">Banco: ${esc(st.dataDir)} · cópias de segurança automáticas (14 dias) · versão ${esc(st.version)}</p></div><button class="btn sm" id="bDir">Abrir pasta de dados</button></div>
      <div style="max-height:220px;overflow:auto;margin-top:12px"><table class="t"><tbody>${logs.map((l) => `<tr><td class="muted" style="white-space:nowrap">${new Date(l.ts).toLocaleString('pt-BR')}</td><td>${l.level === 'error' ? '<span class="chip r">erro</span>' : l.level === 'warn' ? '<span class="chip a">aviso</span>' : '<span class="chip">info</span>'}</td><td>${esc(l.msg)}</td></tr>`).join('') || '<tr><td class="muted">Sem registros</td></tr>'}</tbody></table></div></div>`;
  function hours(v) { return [...Array(24)].map((_, h) => `<option value="${h}" ${String(h) === String(v) ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join(''); }
  const collect = () => ({
    localPort: $('#localPort').value.trim(), relayEnabled: $('#relayEnabled').checked, relayUrl: $('#relayUrl').value.trim(),
    centralKey: $('#centralKey').value.trim(), appKey: $('#appKey').value.trim(), questionHour: $('#questionHour').value,
    reminderHour: $('#reminderHour').value, studyDays: $('#studyDays').value, showScreenTime: $('#showScreenTime').checked,
    institution: $('#institution').value.trim(), centralName: $('#centralName').value.trim(),
  });
  $('#bSave').onclick = async () => { await api.saveSettings(collect()); await refreshBrand(); await refreshStatus(); toast('Configurações salvas'); render(); };
  $('#bTest').onclick = async () => {
    await api.saveSettings(collect()); $('#testMsg').textContent = 'testando…';
    const r = await api.testRelay();
    $('#testMsg').innerHTML = r.ok ? `<span class="chip g">Conectado</span> ${r.health.devices} aparelho(s) na ponte` : `<span class="chip r">${esc(r.error)}</span>`;
  };
  $('#bLogo').onclick = async () => { const r = await api.chooseLogo(); if (r.ok) { await refreshBrand(); render(); } };
  if ($('#bLogoRm')) $('#bLogoRm').onclick = async () => { await api.removeLogo(); await refreshBrand(); render(); };
  $('#bDir').onclick = () => api.openDataDir();
};

// ------------------------------------------------------------------ início
(async () => {
  await refreshBrand();
  await refreshStatus();
  render();
  api.onUpdate(async () => { await refreshStatus(); if (!document.body.classList.contains('printing') && !document.activeElement.matches('input,select')) render(); });
  setInterval(refreshStatus, 15000);
})();
