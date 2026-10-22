/* UI / visual rules. Each rule: {id, cat, sev(1-3), title, why, run(ctx) -> [{el?, detail, fix?}]} */
(function () {
  const S = window.SlopScope;
  const U = S.util;
  const R = U.register;
  const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

  const cardLike = (el, s) => {
    const radius = U.px(s.borderTopLeftRadius);
    const bg = U.parseColor(s.backgroundColor);
    const hasShadow = s.boxShadow && s.boxShadow !== 'none';
    const hasBorder = U.px(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none';
    const r = el.getBoundingClientRect();
    return radius >= 8 && bg && bg.a > 0.1 && (hasShadow || hasBorder) && r.width >= 80 && r.height >= 40;
  };

  R({
    id: 'ui-purple', cat: 'ui', sev: 2,
    title: 'Purple / indigo AI palette',
    why: 'Indigo-to-violet gradients and buttons are the most common default in generated landing pages.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 15) break;
        if (!ctx.vis(el)) continue;
        const s = ctx.cs(el);
        const bgPurple = U.isPurple(U.parseColor(s.backgroundColor));
        const gradPurple = /gradient/.test(s.backgroundImage) && U.allColors(s.backgroundImage).some(U.isPurple);
        const textPurple = ['BUTTON', 'A', 'H1', 'H2'].includes(el.tagName) && U.isPurple(U.parseColor(s.color));
        if (bgPurple || gradPurple || textPurple) out.push({ el, detail: gradPurple ? 'Purple gradient background' : bgPurple ? 'Purple background' : 'Purple text' });
      }
      return out;
    },
  });

  R({
    id: 'ui-gradient-text', cat: 'ui', sev: 2,
    title: 'Gradient text on headings',
    why: 'background-clip:text gradients on hero headings are a signature of template-generated pages.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        const s = ctx.cs(el);
        const clip = s.webkitBackgroundClip || s.backgroundClip;
        if (clip === 'text' && /gradient/.test(s.backgroundImage) && ctx.vis(el)) {
          out.push({
            el, detail: U.snippet(el.textContent, 60),
            fix: () => {
              const parent = el.parentElement ? getComputedStyle(el.parentElement).color : '#111';
              el.style.setProperty('background-image', 'none', 'important');
              el.style.setProperty('-webkit-text-fill-color', 'currentColor', 'important');
              el.style.setProperty('color', parent, 'important');
            },
          });
          if (out.length >= 10) break;
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-side-stripe', cat: 'ui', sev: 2,
    title: 'Coloured side-stripe accent borders',
    why: 'A thick left/right border on a rounded card is a stock "callout" look generated UIs reuse everywhere.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 12) break;
        const s = ctx.cs(el);
        const [l, r, t, b] = [s.borderLeftWidth, s.borderRightWidth, s.borderTopWidth, s.borderBottomWidth].map(U.px);
        const rect = el.getBoundingClientRect();
        if (rect.height < 24 || rect.width < 80) continue;
        if (l >= 3 && t <= 1 && b <= 1 && r <= 1 && s.borderLeftStyle !== 'none') {
          out.push({ el, detail: `${l}px left stripe`, fix: () => el.style.setProperty('border-left', 'none', 'important') });
        } else if (r >= 3 && t <= 1 && b <= 1 && l <= 1 && s.borderRightStyle !== 'none') {
          out.push({ el, detail: `${r}px right stripe`, fix: () => el.style.setProperty('border-right', 'none', 'important') });
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-nested-cards', cat: 'ui', sev: 2,
    title: 'Cards nested inside cards',
    why: 'Rounded, shadowed containers inside rounded, shadowed containers add noise without adding hierarchy.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 10) break;
        if (!cardLike(el, ctx.cs(el))) continue;
        let n = el.parentElement, depth = 0;
        while (n && depth < 4) {
          if (cardLike(n, ctx.cs(n))) {
            out.push({
              el, detail: 'Card inside another card',
              fix: () => {
                el.style.setProperty('box-shadow', 'none', 'important');
                el.style.setProperty('border', 'none', 'important');
                el.style.setProperty('background', 'transparent', 'important');
              },
            });
            break;
          }
          n = n.parentElement; depth++;
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-bounce-easing', cat: 'ui', sev: 1,
    title: 'Bounce / elastic easing',
    why: 'Overshooting cubic-beziers feel playful in demos but dated and distracting in real products.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 10) break;
        const s = ctx.cs(el);
        const str = `${s.transitionTimingFunction} ${s.animationTimingFunction}`;
        const re = /cubic-bezier\(([^)]+)\)/g;
        let m, bad = false;
        while ((m = re.exec(str))) {
          const [, y1, , y2] = m[1].split(',').map(parseFloat);
          if (y1 > 1 || y1 < 0 || y2 > 1 || y2 < 0) bad = true;
        }
        if (bad) {
          out.push({
            el, detail: 'Easing overshoots 0..1',
            fix: () => {
              el.style.setProperty('transition-timing-function', 'cubic-bezier(0.25, 1, 0.5, 1)', 'important');
              el.style.setProperty('animation-timing-function', 'cubic-bezier(0.25, 1, 0.5, 1)', 'important');
            },
          });
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-glow-dark', cat: 'ui', sev: 2,
    title: 'Dark mode with glowing accents',
    why: 'Dark backgrounds with large coloured box-shadow glows are another generated-landing-page staple.',
    run(ctx) {
      const out = [];
      const body = U.parseColor(ctx.cs(document.body).backgroundColor) || U.parseColor(ctx.cs(document.documentElement).backgroundColor);
      if (!body || U.lum(body) > 0.1) return out;
      for (const el of ctx.els) {
        if (out.length >= 10) break;
        const sh = ctx.cs(el).boxShadow;
        if (!sh || sh === 'none') continue;
        const m = sh.match(/(rgba?\([^)]+\))\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/);
        if (!m) continue;
        const c = U.parseColor(m[1]);
        if (c && c.a > 0.15 && parseFloat(m[4]) >= 20 && U.hsl(c).s > 0.5) {
          out.push({ el, detail: `${m[4]}px coloured glow`, fix: () => el.style.setProperty('box-shadow', 'none', 'important') });
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-blur-orbs', cat: 'ui', sev: 2,
    title: 'Blurred gradient orbs',
    why: 'Giant blurred circles behind the hero are decoration that signals "template" rather than a design decision.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 6) break;
        const s = ctx.cs(el);
        const m = (s.filter || '').match(/blur\((\d+(?:\.\d+)?)px\)/);
        if (!m || parseFloat(m[1]) < 40) continue;
        if (!['absolute', 'fixed'].includes(s.position)) continue;
        out.push({ el, detail: `blur(${m[1]}px) decorative layer`, fix: () => el.style.setProperty('display', 'none', 'important') });
      }
      return out;
    },
  });

  R({
    id: 'ui-glass', cat: 'ui', sev: 1,
    title: 'Glassmorphism everywhere',
    why: 'Backdrop-blur panels used on many elements, not one deliberate surface.',
    run(ctx) {
      const hits = ctx.els.filter((el) => {
        const s = ctx.cs(el);
        const f = s.backdropFilter || s.webkitBackdropFilter || '';
        return /blur/.test(f) && ctx.vis(el);
      });
      return hits.length >= 4 ? hits.slice(0, 6).map((el) => ({ el, detail: `${hits.length} backdrop-blur surfaces on page` })) : [];
    },
  });

  R({
    id: 'ui-default-font', cat: 'ui', sev: 2,
    title: 'Default or single-family typography',
    why: 'Inter/Roboto/Poppins everywhere, or one family for every role, means no typographic voice was chosen.',
    run(ctx) {
      const out = [];
      const fam = (el) => ctx.cs(el).fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
      const sample = ctx.els.filter((e) => ['P', 'LI', 'H1', 'H2', 'H3', 'BUTTON', 'A'].includes(e.tagName) && ctx.vis(e)).slice(0, 300);
      const set = new Set(sample.map(fam).filter((f) => !/mono|courier|consolas/.test(f)));
      if (!set.size) return out;
      const generic = ['inter', 'roboto', 'open sans', 'poppins', 'system-ui', '-apple-system', 'arial', 'helvetica', 'sans-serif', 'segoe ui', 'dm sans', 'manrope'];
      const names = [...set];
      if (names.length === 1) out.push({ detail: `Only one font family used: ${names[0]}` });
      if (names.every((f) => generic.includes(f))) out.push({ detail: `Only default families: ${names.join(', ')}` });
      return out;
    },
  });

  R({
    id: 'ui-flat-hierarchy', cat: 'ui', sev: 1,
    title: 'Flat type hierarchy',
    why: 'When the H1 is barely larger than body text, nothing leads the eye.',
    run(ctx) {
      const h1 = ctx.els.find((e) => e.tagName === 'H1' && ctx.vis(e));
      const p = ctx.els.filter((e) => e.tagName === 'P' && ctx.vis(e)).slice(0, 20);
      if (!h1 || !p.length) return [];
      const sizes = p.map((e) => U.px(ctx.cs(e).fontSize)).sort((a, b) => a - b);
      const body = sizes[Math.floor(sizes.length / 2)];
      const ratio = U.px(ctx.cs(h1).fontSize) / body;
      return ratio < 1.75 ? [{ el: h1, detail: `H1 is only ${ratio.toFixed(2)}x body size` }] : [];
    },
  });

  R({
    id: 'ui-oversized-h1', cat: 'ui', sev: 1,
    title: 'Oversized hero headline',
    why: 'H1 above ~96px is usually a hero-template reflex, not a measured choice.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (el.tagName !== 'H1' || !ctx.vis(el)) continue;
        const fs = U.px(ctx.cs(el).fontSize);
        if (fs > 96) out.push({ el, detail: `${Math.round(fs)}px`, fix: () => el.style.setProperty('font-size', 'clamp(2.5rem, 6vw, 4.5rem)', 'important') });
      }
      return out;
    },
  });

  R({
    id: 'ui-tight-tracking', cat: 'ui', sev: 1,
    title: 'Extreme negative letter-spacing',
    why: 'Very tight tracking on headings hurts legibility and is a common generated-hero tell.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (!HEADINGS.slice(0, 3).includes(el.tagName) || !ctx.vis(el)) continue;
        const s = ctx.cs(el);
        const ls = parseFloat(s.letterSpacing);
        const fs = U.px(s.fontSize);
        if (!isNaN(ls) && fs && ls / fs < -0.04) {
          out.push({ el, detail: `${(ls / fs).toFixed(3)}em`, fix: () => el.style.setProperty('letter-spacing', '-0.01em', 'important') });
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-eyebrow', cat: 'ui', sev: 1,
    title: 'Uppercase eyebrow labels above headings',
    why: 'Small tracked-out caps kickers above every section heading are a repeated template move.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 10) break;
        const t = (el.textContent || '').trim();
        if (t.length < 2 || t.length > 30 || el.children.length > 1) continue;
        const next = el.nextElementSibling;
        if (!next || !HEADINGS.slice(0, 3).includes(next.tagName)) continue;
        const s = ctx.cs(el);
        const fs = U.px(s.fontSize);
        const upper = s.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]/.test(t));
        if (upper && fs <= 14 && parseFloat(s.letterSpacing) / fs >= 0.08) out.push({ el, detail: t });
      }
      return out;
    },
  });

  R({
    id: 'ui-icon-tiles', cat: 'ui', sev: 2,
    title: 'Icon-tile feature grid',
    why: 'Three or more cards that each pair a rounded icon tile, a heading and a paragraph.',
    run(ctx) {
      const out = [];
      for (const parent of ctx.els) {
        if (out.length >= 4) break;
        const kids = [...parent.children];
        if (kids.length < 3 || kids.length > 8) continue;
        const match = kids.filter((k) => {
          if (k.children.length < 2) return false;
          const first = k.children[0];
          const r = first.getBoundingClientRect();
          const s = ctx.cs(first);
          const hasIcon = first.querySelector('svg, i, img') || first.tagName === 'SVG';
          const hasHead = k.querySelector('h3, h4');
          const hasPara = k.querySelector('p');
          return hasIcon && hasHead && hasPara && r.width <= 72 && r.height <= 72 && U.px(s.borderTopLeftRadius) >= 6;
        });
        if (match.length >= 3) out.push({ el: parent, detail: `${match.length} icon-tile cards` });
      }
      return out;
    },
  });

  R({
    id: 'ui-hover-zoom', cat: 'ui', sev: 1,
    title: 'Hover scale-up on images/cards',
    why: 'Every card and image growing on hover is a generated-interaction default.',
    run(ctx) {
      const out = [];
      for (const r of ctx.cssRules) {
        if (out.length >= 3) break;
        if (!/:hover/.test(r.selectorText)) continue;
        const t = r.style && r.style.transform;
        if (t && /scale\(\s*1\.(0[3-9]|[1-9])/.test(t)) out.push({ detail: `${U.snippet(r.selectorText, 60)} → ${t}` });
      }
      return out;
    },
  });

  R({
    id: 'ui-cream-bg', cat: 'ui', sev: 1,
    title: 'Cream / beige "editorial" background',
    why: 'Warm off-white backgrounds have become the new default for generated "premium" pages.',
    run(ctx) {
      const out = [];
      for (const el of [document.body, document.documentElement]) {
        const c = U.parseColor(ctx.cs(el).backgroundColor);
        if (c && c.a > 0.9 && c.r > 240 && c.g > 232 && c.b > 210 && c.r - c.b >= 8 && c.r - c.b <= 40) {
          out.push({ el, detail: `rgb(${c.r}, ${c.g}, ${c.b})` });
          break;
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-low-contrast', cat: 'ui', sev: 2,
    title: 'Low text contrast (WCAG AA)',
    why: 'Muted grey text on white or dark-grey on black fails readability checks.',
    run(ctx) {
      const out = [], seen = new Set();
      for (const { el } of ctx.textNodes.slice(0, 700)) {
        if (out.length >= 15) break;
        if (seen.has(el)) continue;
        seen.add(el);
        const s = ctx.cs(el);
        const fg = U.parseColor(s.color);
        const bg = U.effectiveBg(el, ctx.cs);
        if (!fg || !bg || fg.a < 0.9) continue;
        const fs = U.px(s.fontSize);
        const large = fs >= 24 || (fs >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
        const ratio = U.contrast(fg, bg);
        if (ratio < (large ? 3 : 4.5)) {
          out.push({
            el, detail: `${ratio.toFixed(2)}:1`,
            fix: () => {
              const dark = { r: 17, g: 17, b: 17 }, light = { r: 255, g: 255, b: 255 };
              el.style.setProperty('color', U.contrast(dark, bg) >= U.contrast(light, bg) ? '#111' : '#fff', 'important');
            },
          });
        }
      }
      return out;
    },
  });

  R({
    id: 'ui-skipped-headings', cat: 'ui', sev: 1,
    title: 'Skipped heading levels',
    why: 'Jumping from H1 to H4 breaks document outline and screen-reader navigation.',
    run(ctx) {
      const out = [];
      let prev = 0;
      for (const el of ctx.els.filter((e) => HEADINGS.includes(e.tagName) && ctx.vis(e))) {
        const lvl = parseInt(el.tagName[1], 10);
        if (prev && lvl - prev > 1) out.push({ el, detail: `H${prev} → H${lvl}` });
        prev = lvl;
      }
      return out.slice(0, 8);
    },
  });

  R({
    id: 'ui-tiny-text', cat: 'ui', sev: 1,
    title: 'Tiny body text',
    why: 'Running text under 12px is hard to read.',
    run(ctx) {
      const out = [], seen = new Set();
      for (const { el, node } of ctx.textNodes) {
        if (out.length >= 8) break;
        if (seen.has(el) || node.nodeValue.trim().length < 15) continue;
        seen.add(el);
        const fs = U.px(ctx.cs(el).fontSize);
        if (fs && fs < 12) out.push({ el, detail: `${fs}px`, fix: () => el.style.setProperty('font-size', '12px', 'important') });
      }
      return out;
    },
  });

  R({
    id: 'ui-line-length', cat: 'ui', sev: 1,
    title: 'Overlong line length',
    why: 'Paragraphs wider than ~90 characters per line are tiring to read.',
    run(ctx) {
      const out = [];
      for (const el of ctx.els) {
        if (out.length >= 6) break;
        if (el.tagName !== 'P' || (el.textContent || '').length < 200 || !ctx.vis(el)) continue;
        const fs = U.px(ctx.cs(el).fontSize) || 16;
        const chars = el.getBoundingClientRect().width / (fs * 0.5);
        if (chars > 95) out.push({ el, detail: `~${Math.round(chars)} chars per line`, fix: () => el.style.setProperty('max-width', '68ch', 'important') });
      }
      return out;
    },
  });
})();
