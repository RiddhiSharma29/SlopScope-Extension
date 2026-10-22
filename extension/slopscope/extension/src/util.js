/* SlopScope shared helpers. Loaded first; everything hangs off window.SlopScope. */
(function () {
  const S = (window.SlopScope = window.SlopScope || { rules: [] });
  const U = (S.util = {});

  U.register = (rule) => S.rules.push(rule);

  U.parseColor = (str) => {
    if (!str) return null;
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.some(isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  U.allColors = (str) => {
    const out = [];
    const re = /rgba?\([^)]+\)/g;
    let m;
    while ((m = re.exec(str || ''))) {
      const c = U.parseColor(m[0]);
      if (c) out.push(c);
    }
    return out;
  };

  U.hsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, l };
  };

  // Indigo / violet / purple band that generated UIs love.
  U.isPurple = (c) => {
    if (!c || c.a < 0.3) return false;
    const { h, s, l } = U.hsl(c);
    // s > 0.95 excludes the browser-default link blue (#0000ee), which is not an AI tell.
    return h >= 238 && h <= 300 && s >= 0.4 && s <= 0.95 && l >= 0.25 && l <= 0.78;
  };

  U.lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  U.contrast = (a, b) => {
    const l1 = U.lum(a), l2 = U.lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  // First opaque background walking up the tree. null = unknown (gradient / image behind).
  U.effectiveBg = (el, cs) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const s = cs(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = U.parseColor(s.backgroundColor);
      if (c && c.a > 0.95) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  U.selector = (el) => {
    if (!el || !el.tagName) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 3) {
      let s = n.tagName.toLowerCase();
      const c = (n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
      if (c) s += '.' + CSS.escape(c);
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(' > ');
  };

  U.snippet = (t, n = 90) => {
    t = (t || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };

  U.cssRules = () => {
    const out = [];
    const walk = (rules) => {
      for (const r of rules) {
        if (r.selectorText) out.push(r);
        else if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sh of document.styleSheets) {
      try { walk(sh.cssRules); } catch (e) { /* cross-origin sheet */ }
    }
    return out;
  };

  U.visible = (el, cs) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  U.px = (v) => parseFloat(v) || 0;
})();
