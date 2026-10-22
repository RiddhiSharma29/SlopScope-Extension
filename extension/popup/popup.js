const $ = (id) => document.getElementById(id);
const CATS = [['ui', 'UI'], ['text', 'Text'], ['image', 'Image'], ['code', 'Code']];
let tabId = null;
let report = null;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text; // page-derived strings only ever go through textContent
  return n;
}

function send(msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(res);
    });
  });
}

function setStatus(t) { $('status').textContent = t; }

function render(rep) {
  report = rep;
  $('host').textContent = rep.host || rep.url;
  $('score').textContent = rep.score.overall;
  $('verdict').textContent = rep.score.verdict;

  const cats = $('cats');
  cats.replaceChildren();
  for (const [key, label] of CATS) {
    const v = rep.score.categories[key];
    const row = el('div', `cat cat-${key}`);
    row.append(el('span', 'tag', label));
    const bar = el('div', 'bar');
    const fill = document.createElement('i');
    fill.style.width = v + '%';
    bar.append(fill);
    row.append(bar, el('span', 'mono', String(v)));
    cats.append(row);
  }

  const list = $('list');
  list.replaceChildren();
  if (!rep.findings.length) {
    list.append(el('p', 'empty muted', 'No slop found. Either this page is clean or the rules missed it.'));
    return;
  }
  for (const [key, label] of CATS) {
    const items = rep.findings.filter((f) => f.category === key);
    if (!items.length) continue;
    const group = el('section', 'group');
    const h = el('h2', `cat-${key}`, `${label} · ${items.length}`);
    group.append(h);
    // collapse same-rule findings into one block with a count
    const byRule = new Map();
    for (const f of items) (byRule.get(f.ruleId) || byRule.set(f.ruleId, []).get(f.ruleId)).push(f);
    for (const fs of byRule.values()) {
      const f = fs[0];
      const box = el('div', 'finding');
      box.append(el('h3', '', fs.length > 1 ? `${f.title} (×${fs.length})` : f.title));
      if (f.detail) box.append(el('div', 'detail', f.detail));
      box.append(el('div', 'why', f.why));
      const row = el('div', 'row');
      const loc = fs.find((x) => x.locatable);
      if (loc) {
        const b = el('button', '', 'Locate');
        b.onclick = () => send({ type: 'FOCUS', id: loc.id });
        row.append(b);
      }
      const fixable = fs.filter((x) => x.fixable);
      if (fixable.length) {
        const b = el('button', '', fixable.length > 1 ? `Fix ${fixable.length}` : 'Fix');
        b.onclick = async () => {
          for (const x of fixable) await send({ type: 'FIX', id: x.id });
          setStatus(`Applied ${fixable.length} fix${fixable.length > 1 ? 'es' : ''} (preview only, reload page to undo).`);
          b.disabled = true;
        };
        row.append(b);
      }
      box.append(row);
      group.append(box);
    }
    list.append(group);
  }
}

async function scan() {
  setStatus('Scanning…');
  const rep = await send({ type: 'SCAN' });
  if (!rep) {
    $('host').textContent = 'Cannot scan this page';
    $('list').replaceChildren(el('p', 'empty muted', 'Chrome pages, the Web Store and PDFs are blocked. On other pages, reload the tab once after installing the extension.'));
    setStatus('');
    return;
  }
  render(rep);
  setStatus(`${rep.totalFindings} findings from ${rep.rulesRun} rules.`);
}

$('rescan').onclick = scan;
$('toggle').onclick = async () => {
  const r = await send({ type: 'TOGGLE_OVERLAY' });
  if (r) setStatus(r.overlayOn ? 'Overlay on.' : 'Overlay off.');
};
$('fixall').onclick = async () => {
  setStatus('Applying fixes…');
  const r = await send({ type: 'FIX_ALL' });
  if (!r) return setStatus('Could not apply fixes.');
  render(r.after);
  setStatus(`Applied ${r.fixed} fixes. Score ${r.before.overall} → ${r.after.score.overall}. Reload the page to undo.`);
};
$('dash').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  tabId = tabs[0] && tabs[0].id;
  if (tabId == null) return setStatus('No active tab.');
  scan();
});
