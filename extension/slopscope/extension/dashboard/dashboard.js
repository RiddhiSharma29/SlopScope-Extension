const $ = (id) => document.getElementById(id);
const CATS = ['ui', 'text', 'image', 'code'];
let history = [];
let selected = new Set();

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function load() {
  chrome.storage.local.get({ history: [] }, (d) => { history = d.history; render(); });
}
function save(cb) { chrome.storage.local.set({ history }, cb); }

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function render() {
  renderStats();
  renderRows();
  renderRules();
  $('compare').disabled = selected.size !== 2;
  $('cmp-hint').textContent = selected.size ? `${selected.size} selected` : '';
}

function renderStats() {
  const s = $('stats');
  s.replaceChildren();
  const avg = history.length ? Math.round(history.reduce((a, h) => a + h.score.overall, 0) / history.length) : 0;
  const worst = history.slice().sort((a, b) => b.score.overall - a.score.overall)[0];
  const total = history.reduce((a, h) => a + h.totalFindings, 0);
  const items = [
    [history.length, 'Scans'], [avg, 'Average score'],
    [worst ? worst.score.overall : '–', worst ? `Worst: ${worst.host}` : 'Worst'], [total, 'Total findings'],
  ];
  for (const [n, l] of items) {
    const d = el('div', 'stat');
    d.append(el('div', 'n', String(n)), el('div', 'l', l));
    s.append(d);
  }
}

function renderRows() {
  const body = $('rows');
  body.replaceChildren();
  if (!history.length) {
    const tr = el('tr');
    const td = el('td', 'muted', 'No scans yet. Open the SlopScope popup on any page.');
    td.colSpan = 10;
    tr.append(td);
    body.append(tr);
    return;
  }
  const sorted = history.slice().sort((a, b) => b.score.overall - a.score.overall);
  for (const h of sorted) {
    const tr = el('tr');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.has(h.id);
    cb.setAttribute('aria-label', `Select scan of ${h.host}`);
    cb.onchange = () => {
      if (cb.checked) selected.add(h.id); else selected.delete(h.id);
      if (selected.size > 2) { selected = new Set([...selected].slice(-2)); }
      render();
    };
    const c0 = el('td'); c0.append(cb);
    const site = el('td', 'site', h.host || h.url);
    site.append(el('small', '', h.afterFix ? `after fix (was ${h.afterFix.from})` : (h.title || '')));
    tr.append(c0, el('td', 'score', String(h.score.overall)), site);
    for (const c of CATS) tr.append(el('td', 'n', String(h.score.categories[c])));
    tr.append(el('td', 'n', String(h.totalFindings)), el('td', 'n', new Date(h.ts).toLocaleString()));
    const act = el('td');
    const view = el('button', '', 'View');
    view.onclick = () => showDetail(h);
    const del = el('button', '', 'Delete');
    del.onclick = () => { history = history.filter((x) => x.id !== h.id); selected.delete(h.id); save(render); };
    act.append(view, ' ', del);
    tr.append(act);
    body.append(tr);
  }
}

function renderRules() {
  const box = $('rules');
  box.replaceChildren();
  const counts = {};
  for (const h of history) {
    for (const f of h.findings) {
      const k = f.ruleId;
      counts[k] = counts[k] || { n: 0, title: f.title, cat: f.category };
      counts[k].n++;
    }
  }
  const top = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 10);
  const max = top.length ? top[0].n : 1;
  for (const t of top) {
    const row = el('div', 'rule-row');
    row.append(el('span', `cat-${t.cat}`, t.title));
    const bar = el('div', 'bar');
    const fill = document.createElement('i');
    fill.style.width = (t.n / max) * 100 + '%';
    bar.append(fill);
    row.append(bar, el('span', 'mono', String(t.n)));
    box.append(row);
  }
  if (!top.length) box.append(el('p', 'muted', 'Nothing yet.'));
}

function showDetail(h) {
  $('detail-panel').hidden = false;
  $('detail-title').textContent = `Scan detail · ${h.host}`;
  const body = $('detail-body');
  body.replaceChildren(el('p', 'mono muted', `${h.url}`));
  for (const c of CATS) {
    const items = h.findings.filter((f) => f.category === c);
    if (!items.length) continue;
    const g = el('div', 'fgroup');
    g.append(el('h3', `cat-${c}`, `${c} · ${items.length}`));
    for (const f of items) {
      const row = el('div', 'fitem');
      row.append(el('div', '', f.title));
      if (f.detail) row.append(el('div', 'd', f.detail));
      g.append(row);
    }
    body.append(g);
  }
  $('detail-panel').scrollIntoView({ behavior: 'smooth' });
}

function showCompare() {
  const [a, b] = [...selected].map((id) => history.find((h) => h.id === id)).sort((x, y) => x.ts - y.ts);
  $('compare-panel').hidden = false;
  const body = $('compare-body');
  body.replaceChildren();
  const grid = el('div', 'cmp');
  grid.append(el('div', 'tag', 'Metric'), el('div', 'tag', `Earlier · ${a.host}`), el('div', 'tag', `Later · ${b.host}`));
  const rowsData = [['Overall', a.score.overall, b.score.overall], ...CATS.map((c) => [c.toUpperCase(), a.score.categories[c], b.score.categories[c]]), ['Findings', a.totalFindings, b.totalFindings]];
  for (const [label, x, y] of rowsData) {
    const d = y - x;
    grid.append(el('div', '', label), el('div', 'mono', String(x)));
    const cell = el('div', 'mono');
    cell.append(`${y} `);
    cell.append(el('span', d < 0 ? 'delta-good' : d > 0 ? 'delta-bad' : 'muted', d === 0 ? '±0' : (d > 0 ? '+' : '') + d));
    grid.append(cell);
  }
  body.append(grid);
  $('compare-panel').scrollIntoView({ behavior: 'smooth' });
}

$('compare').onclick = showCompare;
$('clear').onclick = () => { if (confirm('Delete all scan history?')) { history = []; selected.clear(); save(render); } };
$('export-json').onclick = () => download('slopscope-history.json', JSON.stringify(history, null, 2), 'application/json');
$('export-csv').onclick = () => {
  const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [['host', 'url', 'score', 'ui', 'text', 'image', 'code', 'findings', 'scanned'].join(',')];
  for (const h of history) lines.push([h.host, h.url, h.score.overall, ...CATS.map((c) => h.score.categories[c]), h.totalFindings, new Date(h.ts).toISOString()].map(esc).join(','));
  download('slopscope-history.csv', lines.join('\n'), 'text/csv');
};
$('import').onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((t) => {
    try {
      const incoming = JSON.parse(t);
      if (!Array.isArray(incoming)) throw new Error('not an array');
      const ids = new Set(history.map((h) => h.id));
      history = [...incoming.filter((h) => h && h.id && h.score && !ids.has(h.id)), ...history].slice(0, 200);
      save(render);
    } catch (err) { alert('Could not import: ' + err.message); }
  });
};

load();
chrome.storage.onChanged.addListener(load);
