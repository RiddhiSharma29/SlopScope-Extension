/* Scoring. Higher = more slop. 0-100 overall plus a score per category. */
(function () {
  const S = window.SlopScope;
  const WEIGHTS = { ui: 0.3, text: 0.25, image: 0.2, code: 0.25 };

  S.score = function (findings) {
    const byRule = {};
    for (const f of findings) {
      (byRule[f.ruleId] = byRule[f.ruleId] || { cat: f.category, sev: f.severity, n: 0 }).n++;
    }
    const cats = { ui: 0, text: 0, image: 0, code: 0 };
    for (const r of Object.values(byRule)) {
      const penalty = Math.min(r.sev * 18, r.sev * 6 * (1 + Math.log2(r.n)));
      cats[r.cat] += penalty;
    }
    for (const k of Object.keys(cats)) cats[k] = Math.min(100, Math.round(cats[k]));
    const weighted = Object.keys(cats).reduce((a, k) => a + cats[k] * WEIGHTS[k], 0);
    const max = Math.max(...Object.values(cats));
    const overall = Math.min(100, Math.round(0.5 * weighted + 0.5 * max));
    const verdict = overall <= 20 ? 'Clean' : overall <= 45 ? 'Mild slop' : overall <= 70 ? 'Sloppy' : 'Peak slop';
    return { overall, categories: cats, verdict };
  };
})();
