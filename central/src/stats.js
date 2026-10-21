// Estatística de concordância (validade de critério) — Bland & Altman (1995, 2007)
'use strict';

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
function sd(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

/**
 * Concordância entre o IF Screen (x) e o padrão-ouro (y), em minutos/dia.
 * @param {Array<{subject:string, x:number, y:number}>} pairs
 */
function agreement(pairs) {
  const n = pairs.length;
  const out = { n, subjects: new Set(pairs.map((p) => p.subject)).size };
  if (!n) return out;
  const d = pairs.map((p) => p.x - p.y);
  const absd = d.map(Math.abs);
  out.bias = mean(d);
  out.sdSimple = sd(d);
  out.mae = mean(absd);
  out.maxAbs = Math.max(...absd);
  out.mape = mean(pairs.filter((p) => p.y > 0).map((p) => Math.abs(p.x - p.y) / p.y * 100));
  out.within1 = absd.filter((v) => v <= 1).length / n * 100;
  out.within5 = absd.filter((v) => v <= 5).length / n * 100;
  out.within15 = absd.filter((v) => v <= 15).length / n * 100;
  out.exact = absd.filter((v) => v < 0.5).length / n * 100; // mesmo minuto exibido
  const ba = blandAltmanRepeated(pairs);
  out.sd = ba.sd;
  out.loaLow = out.bias - 1.96 * out.sd;
  out.loaHigh = out.bias + 1.96 * out.sd;
  out.pearson = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
  out.rmcorr = rmcorr(pairs);
  // IC 95% aproximado do viés (t ≈ 1,96 para n grande)
  out.biasCiLow = out.bias - 1.96 * (out.sdSimple / Math.sqrt(n));
  out.biasCiHigh = out.bias + 1.96 * (out.sdSimple / Math.sqrt(n));
  return out;
}

/**
 * DP das diferenças para medidas repetidas quando o valor verdadeiro varia
 * entre os dias (Bland & Altman, 2007, seção 5): ANOVA de um fator nas
 * diferenças por indivíduo. Var = σ²_d(entre) + σ²_w(dentro).
 */
function blandAltmanRepeated(pairs) {
  const groups = new Map();
  for (const p of pairs) {
    if (!groups.has(p.subject)) groups.set(p.subject, []);
    groups.get(p.subject).push(p.x - p.y);
  }
  const N = pairs.length; const k = groups.size;
  if (N < 2) return { sd: NaN };
  if (k < 2 || N === k) return { sd: sd(pairs.map((p) => p.x - p.y)) };
  const grand = mean(pairs.map((p) => p.x - p.y));
  let ssb = 0; let ssw = 0; let sumM2 = 0;
  for (const arr of groups.values()) {
    const m = mean(arr);
    ssb += arr.length * (m - grand) ** 2;
    ssw += arr.reduce((s, v) => s + (v - m) ** 2, 0);
    sumM2 += arr.length ** 2;
  }
  const msb = ssb / (k - 1);
  const msw = ssw / (N - k);
  const divisor = (N * N - sumM2) / ((k - 1) * N);
  const varB = Math.max(0, (msb - msw) / divisor);
  return { sd: Math.sqrt(varB + msw), msb, msw };
}

function pearson(x, y) {
  const n = x.length; if (n < 3) return NaN;
  const mx = mean(x); const my = mean(y);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Correlação de medidas repetidas (Bland & Altman, 1995; pacote rmcorr). */
function rmcorr(pairs) {
  const groups = new Map();
  for (const p of pairs) { if (!groups.has(p.subject)) groups.set(p.subject, []); groups.get(p.subject).push(p); }
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const mx = mean(arr.map((p) => p.x)); const my = mean(arr.map((p) => p.y));
    for (const p of arr) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  }
  if (!sxx || !syy) return NaN;
  const b = sxy / sxx;
  const ssModel = b * sxy;
  const ssErr = syy - ssModel;
  return Math.sign(b) * Math.sqrt(ssModel / (ssModel + ssErr));
}

module.exports = { agreement, blandAltmanRepeated, pearson, rmcorr, mean, sd };
