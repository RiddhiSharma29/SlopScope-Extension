/* Text slop rules. Heuristic, explainable, no network. */
(function () {
  const S = window.SlopScope;
  const U = S.util;
  const R = U.register;

  const BUZZ = [
    'delve', 'tapestry', 'elevate', 'seamless', 'seamlessly', 'unlock the power', 'leverage', 'game-changer', 'game-changing',
    'cutting-edge', 'revolutionize', 'supercharge', 'next-level', 'robust', 'holistic', 'synergy', 'streamline', 'empower',
    'digital landscape', 'ever-evolving', 'unleash', 'harness the power', 'testament to', 'navigate the complexities',
    'utilize', 'utilizes', 'utilizing', 'transformative', 'groundbreaking', 'state-of-the-art', 'unparalleled', 'embark on',
  ];
  const buzzRe = new RegExp('\\b(' + BUZZ.map((w) => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|') + ')\\b', 'gi');

  const SWAPS = [
    [/\butilize\b/gi, 'use'], [/\butilizes\b/gi, 'uses'], [/\butilizing\b/gi, 'using'], [/\butilized\b/gi, 'used'],
    [/\bseamlessly\b/gi, 'smoothly'], [/\bseamless\b/gi, 'smooth'],
    [/\bcutting-edge\b/gi, 'modern'], [/\bdelve into\b/gi, 'look at'],
  ];
  const matchCase = (orig, rep) => (orig[0] === orig[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep);

  R({
    id: 'text-buzzwords', cat: 'text', sev: 2,
    title: 'Marketing buzzwords',
    why: 'Words like "delve", "seamless", "leverage" and "empower" are heavily over-represented in model-written copy.',
    run(ctx) {
      const out = [], seen = new Set();
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 20) break;
        const hits = [...new Set((node.nodeValue.match(buzzRe) || []).map((w) => w.toLowerCase()))];
        if (!hits.length || seen.has(el)) continue;
        seen.add(el);
        const swappable = SWAPS.some(([re]) => { re.lastIndex = 0; return re.test(node.nodeValue); });
        out.push({
          el, detail: hits.join(', '),
          fix: swappable ? () => {
            let v = node.nodeValue;
            for (const [re, rep] of SWAPS) v = v.replace(re, (m) => matchCase(m, rep));
            node.nodeValue = v;
          } : undefined,
        });
      }
      return out;
    },
  });

  R({
    id: 'text-em-dash', cat: 'text', sev: 1,
    title: 'Em-dash overuse',
    why: 'Frequent spaced em-dashes in marketing copy are a strong stylistic marker of model output.',
    run(ctx) {
      const out = [];
      const total = (ctx.text.match(/—/g) || []).length;
      const density = ctx.text.length ? (total / ctx.text.length) * 1000 : 0;
      if (density > 3 && total >= 4) out.push({ detail: `${total} em-dashes, ${density.toFixed(1)} per 1,000 characters` });
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 10) break;
        if ((node.nodeValue.match(/—/g) || []).length >= 2) {
          out.push({ el, detail: U.snippet(node.nodeValue, 70), fix: () => { node.nodeValue = node.nodeValue.replace(/\s*—\s*/g, ', '); } });
        }
      }
      return out;
    },
  });

  const PATTERNS = [
    { label: '"not just X, it\'s Y" contrast', re: /\b(?:isn'?t|is not|not|aren'?t)\s+(?:just|only|merely|simply)\b[^.!?]{2,80}?[,;—-]\s*(?:it'?s|it is|they'?re|but)\b/i },
    { label: '"more than just"', re: /\bmore than just\b/i },
    { label: '"whether you\'re a… or a…"', re: /\bwhether you'?re an? [^.]{3,40} or an? /i },
    { label: '"in today\'s fast-paced…" opener', re: /\bin today'?s (?:fast-paced|digital|ever-changing|competitive|modern)\b/i },
    { label: 'Filler opener ("dive in", "look no further")', re: /\b(?:let'?s dive|dive (?:in|into|deep)|look no further|welcome to the future|the future of \w+ is here)\b/i },
    { label: 'Staccato triplet ("Fast. Simple. Secure.")', re: /^(?:[A-Z][\w-]*(?: [\w-]+)?\.\s*){3,}$/ },
  ];

  R({
    id: 'text-cadence', cat: 'text', sev: 2,
    title: 'Stock sentence patterns',
    why: 'Contrast frames, filler openers and staccato triplets repeat across generated copy.',
    run(ctx) {
      const out = [];
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 20) break;
        const t = node.nodeValue.trim();
        if (t.length < 12) continue;
        const p = PATTERNS.find((x) => x.re.test(t));
        if (p) out.push({ el, detail: `${p.label}: ${U.snippet(t, 70)}` });
      }
      return out;
    },
  });

  R({
    id: 'text-emoji-bullets', cat: 'text', sev: 1,
    title: 'Emoji as bullets / heading icons',
    why: 'Leading emoji on headings, list items and buttons is a pervasive chat-model habit.',
    run(ctx) {
      const out = [];
      const lead = /^\s*\p{Extended_Pictographic}️?\s*/u;
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 10) break;
        if (!['H1', 'H2', 'H3', 'H4', 'LI', 'BUTTON', 'A', 'SPAN', 'P'].includes(el.tagName)) continue;
        if (lead.test(node.nodeValue) && node.nodeValue.trim().length > 4 && !el.firstChild.previousSibling && el.firstChild === node) {
          out.push({ el, detail: U.snippet(node.nodeValue, 50), fix: () => { node.nodeValue = node.nodeValue.replace(lead, ''); } });
        }
      }
      return out;
    },
  });

  R({
    id: 'text-placeholder', cat: 'text', sev: 3,
    title: 'Placeholder copy left in',
    why: 'Lorem ipsum, "John Doe" and "Your Company" mean the page was never finished.',
    run(ctx) {
      const out = [];
      const re = /\b(lorem ipsum|dolor sit amet|john doe|jane doe|your company|company name|your name here|acme (?:inc|corp)|insert .{1,20} here)\b/i;
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 10) break;
        const m = node.nodeValue.match(re);
        if (m) out.push({ el, detail: m[1] });
      }
      return out;
    },
  });

  R({
    id: 'text-ai-names', cat: 'text', sev: 1,
    title: 'Model-default persona names',
    why: 'Testimonial authors like "Sarah Chen" or "Marcus Johnson" recur constantly in generated demos.',
    run(ctx) {
      const out = [];
      const re = /\b(sarah chen|michael chen|marcus johnson|emily rodriguez|alex rivera|jordan lee|maya patel|david kim|priya sharma|james wilson)\b/i;
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 8) break;
        const m = node.nodeValue.match(re);
        if (m) out.push({ el, detail: m[1] });
      }
      return out;
    },
  });

  R({
    id: 'text-round-claims', cat: 'text', sev: 1,
    title: 'Round-number social proof',
    why: 'Stats such as "10x faster", "99.9% uptime", "10,000+ teams" are the default filler in generated pages.',
    run(ctx) {
      const out = [];
      const re = /\b(10x|99\.9%|10,000\+|50,000\+|100,000\+|1M\+|10M\+)\b/i;
      for (const { node, el } of ctx.textNodes) {
        if (out.length >= 6) break;
        const m = node.nodeValue.match(re);
        if (m) out.push({ el, detail: m[1] });
      }
      return out;
    },
  });

  R({
    id: 'text-burstiness', cat: 'text', sev: 1,
    title: 'Suspiciously uniform sentence length',
    why: 'Human writing varies sentence length ("burstiness"); generated copy tends to hold a steady rhythm.',
    run(ctx) {
      const sentences = ctx.text.split(/(?<=[.!?])\s+/).map((s) => s.trim().split(/\s+/).length).filter((n) => n >= 4 && n <= 60);
      if (sentences.length < 8) return [];
      const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
      const sd = Math.sqrt(sentences.reduce((a, b) => a + (b - mean) ** 2, 0) / sentences.length);
      const cv = sd / mean;
      return cv < 0.35 ? [{ detail: `${sentences.length} sentences, length variation ${cv.toFixed(2)} (human prose is usually above 0.5)` }] : [];
    },
  });
})();
