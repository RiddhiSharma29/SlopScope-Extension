// Stores scan history so the dashboard can rank sites and compare before/after.
const MAX_HISTORY = 40;

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== 'SAVE_REPORT') return false;
  chrome.storage.local.get({ history: [] }, ({ history }) => {
    const r = msg.report;
    history.unshift({
      id: `${r.ts}-${Math.random().toString(36).slice(2, 7)}`,
      url: r.url, host: r.host, title: r.title, ts: r.ts,
      score: r.score, totalFindings: r.totalFindings, findings: r.findings,
      afterFix: typeof msg.fixedFrom === 'number' ? { from: msg.fixedFrom } : undefined,
    });
    chrome.storage.local.set({ history: history.slice(0, MAX_HISTORY) }, () => reply({ ok: true }));
  });
  return true;
});
