// Exporta eventos do gerador (30 aparelhos) e a verdade por dia para o teste de paridade em Kotlin.
const { generateDevice } = require('../simulator/generator');
const { clip, sum } = require('../algorithm/screentime');
const fs = require('fs');
const TZ = -3 * 3600000; const ds = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) - TZ; };
const T0 = ds('2026-10-12'); const END = ds('2026-10-20') + 15 * 3600000;
const days = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
const out = '/tmp/claude-0/parity'; const exp = [];
for (let i = 0; i < 30; i++) {
  const g = generateDevice(1000 + i, T0, END);
  fs.writeFileSync(`${out}/dev${i}.csv`, g.events.map((e) => `${e.t},${e.type},${e.pkg || ''}`).join('\n'));
  for (const d of days) { const s = ds(d); const c = clip(g.truth, s, s + 86400000); exp.push([i, d, s, sum(c), c.length].join(',')); }
}
fs.writeFileSync(`${out}/expected.csv`, exp.join('\n'));
