/* Scanner: builds context, runs rules, draws overlay, applies fixes, talks to popup. */
(function () {
  const S = window.SlopScope;
  if (!S || S.__scannerLoaded) return;
  S.__scannerLoaded = true;

  const U = S.util;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'BR', 'HEAD', 'TEMPLATE']);
  const CAT_COLORS = { ui: '#d9300f', text: '#0b6bcb', image: '#0a7d4f', code: '#b36b00' };

  let current = []; // findings with live element refs and fix closures
  let overlayOn = true;

  function buildCtx() {
    const cache = new WeakMap();
    const cs = (el) => {
      let v = cache.get(el);
      if (!v) { v = getComputedStyle(el); cache.set(el, v); }
      return v;
    };
    const visCache = new WeakMap();
    const vis = (el) => {
      if (!visCache.has(el)) visCache.set(el, U.visible(el, cs));
      return visCache.get(el);
    };
    const els = [...document.body.querySelectorAll('*')]
      .filter((e) => !SKIP.has(e.tagName) && !(e instanceof SVGElement) && !e.closest('#slopscope-tip'))
      .slice(0, 4000);

    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode()) && textNodes.length < 3000) {
      const el = n.parentElement;
      if (!el || SKIP.has(el.tagName) || !n.nodeValue.trim()) continue;
      if (el.closest('svg') || el.id === 'slopscope-tip') continue;
      if (!U.visible(el, cs)) continue;
      textNodes.push({ node: n, el });
    }
    return {
      els, cs, vis, textNodes,
      text: textNodes.map((t) => t.node.nodeValue.trim()).join(' '),
      cssRules: U.cssRules(),
    };
  }

  function clearOverlay() {
    document.querySelectorAll('[data-slopscope]').forEach((el) => {
      el.removeAttribute('data-slopscope');
      el.removeAttribute('data-slopscope-ids');
    });
    const st = document.getElementById('slopscope-style');
    if (st) st.remove();
    const tip = document.getElementById('slopscope-tip');
    if (tip) tip.remove();
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('mouseout', onOut, true);
  }

  function drawOverlay() {
    clearOverlay();
    if (!overlayOn) return;
    const st = document.createElement('style');
    st.id = 'slopscope-style';
    st.textContent = Object.entries(CAT_COLORS)
      .map(([c, col]) => `[data-slopscope="${c}"]{outline:2px dashed ${col} !important;outline-offset:2px !important}`)
      .join('\n') +
      '\n#slopscope-tip{position:fixed;z-index:2147483647;max-width:320px;padding:8px 10px;background:#111;color:#fff;font:12px/1.4 ui-monospace,Menlo,monospace;pointer-events:none;display:none}';
    document.documentElement.appendChild(st);
    for (const f of current) {
      if (!f.el || !f.el.isConnected) continue;
      const prev = f.el.getAttribute('data-slopscope-ids');
      f.el.setAttribute('data-slopscope', f.category);
      f.el.setAttribute('data-slopscope-ids', prev ? prev + ',' + f.id : String(f.id));
    }
    const tip = document.createElement('div');
    tip.id = 'slopscope-tip';
    document.documentElement.appendChild(tip);
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
  }

  function onOver(e) {
    const host = e.target.closest && e.target.closest('[data-slopscope-ids]');
    const tip = document.getElementById('slopscope-tip');
    if (!host || !tip) return;
    const ids = host.getAttribute('data-slopscope-ids').split(',').map(Number);
    const lines = current.filter((f) => ids.includes(f.id)).map((f) => `${f.title}${f.detail ? ': ' + f.detail : ''}`);
    tip.textContent = lines.join('\n');
    tip.style.whiteSpace = 'pre-wrap';
    const r = host.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = Math.max(8, Math.min(r.left, innerWidth - 330)) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 6) + 'px';
  }
  function onOut() {
    const tip = document.getElementById('slopscope-tip');
    if (tip) tip.style.display = 'none';
  }

  function scan() {
    clearOverlay();
    const ctx = buildCtx();
    current = [];
    let id = 1;
    const ruleMeta = {};
    for (const rule of S.rules) {
      ruleMeta[rule.id] = { title: rule.title, why: rule.why, category: rule.cat, severity: rule.sev };
      let res = [];
      try { res = rule.run(ctx) || []; } catch (e) { console.warn('[SlopScope] rule failed', rule.id, e); }
      for (const r of res) {
        current.push({
          id: id++, ruleId: rule.id, category: rule.cat, severity: rule.sev, title: rule.title, why: rule.why,
          detail: r.detail || '', el: r.el, fix: r.fix,
        });
      }
    }
    drawOverlay();
    return report();
  }

  function report() {
    const findings = current.map((f) => ({
      id: f.id, ruleId: f.ruleId, category: f.category, severity: f.severity, title: f.title, why: f.why,
      detail: f.detail, selector: f.el ? U.selector(f.el) : '', fixable: typeof f.fix === 'function', locatable: !!f.el,
    }));
    return {
      url: location.href, host: location.hostname, title: document.title, ts: Date.now(),
      score: S.score(findings), findings: findings.slice(0, 150), totalFindings: findings.length,
      rulesRun: S.rules.length,
    };
  }

  function applyFix(id) {
    const f = current.find((x) => x.id === id);
    if (!f || !f.fix) return false;
    try { f.fix(); } catch (e) { return false; }
    if (f.el) { f.el.removeAttribute('data-slopscope'); f.el.removeAttribute('data-slopscope-ids'); }
    f.fixed = true;
    return true;
  }

  function focus(id) {
    const f = current.find((x) => x.id === id);
    if (!f || !f.el || !f.el.isConnected) return false;
    f.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const old = f.el.style.outline;
    f.el.style.setProperty('outline', '4px solid #ffcc00', 'important');
    setTimeout(() => { f.el.style.outline = old; }, 1400);
    return true;
  }

  S.scan = scan; // used by the benchmark script too

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (msg.type === 'SCAN') {
        const rep = scan();
        chrome.runtime.sendMessage({ type: 'SAVE_REPORT', report: rep });
        reply(rep);
      } else if (msg.type === 'TOGGLE_OVERLAY') {
        overlayOn = !overlayOn;
        drawOverlay();
        reply({ overlayOn });
      } else if (msg.type === 'FOCUS') {
        reply({ ok: focus(msg.id) });
      } else if (msg.type === 'FIX') {
        reply({ ok: applyFix(msg.id) });
      } else if (msg.type === 'FIX_ALL') {
        const before = report();
        const fixed = current.filter((f) => f.fix && !f.fixed).map((f) => f.id).filter(applyFix).length;
        const after = scan();
        chrome.runtime.sendMessage({ type: 'SAVE_REPORT', report: after, fixedFrom: before.score.overall });
        reply({ fixed, before: before.score, after });
      }
      return true;
    });
  }
})();
