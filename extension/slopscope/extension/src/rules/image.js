/* Image slop rules. URL / filename / alt heuristics plus one pixel check. */
(function () {
  const S = window.SlopScope;
  const U = S.util;
  const R = U.register;

  const AI_HOSTS = /oaidalleapiprodscus|dalle|midjourney|leonardo\.ai|firefly|stablediffusion|replicate\.delivery|ideogram|pollinations|openart|getimg\.ai|lexica\.art/i;
  const PLACEHOLDER_HOSTS = /picsum\.photos|placehold\.co|placeholder\.com|dummyimage|placeimg|lorempixel|pravatar|randomuser\.me|ui-avatars|thispersondoesnotexist|source\.unsplash\.com|images\.unsplash\.com/i;
  const GENERATED_NAMES = /(dall.?e|midjourney|gemini[_-]generated|chatgpt[ _-]image|ideogram|firefly|generated[_-]?image|image[_-]?\d{10,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-)/i;

  function sources(ctx) {
    const out = [];
    for (const img of document.images) {
      const r = img.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) continue;
      const url = img.currentSrc || img.src;
      if (url && !url.startsWith('data:')) out.push({ el: img, url, kind: 'img' });
    }
    let n = 0;
    for (const el of ctx.els) {
      if (n > 300) break;
      const bg = ctx.cs(el).backgroundImage;
      if (!bg || bg === 'none') continue;
      n++;
      const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m && !m[1].startsWith('data:')) out.push({ el, url: m[1], kind: 'bg' });
    }
    return out;
  }

  R({
    id: 'img-ai-host', cat: 'image', sev: 3,
    title: 'Image served from an AI generator host',
    why: 'The image URL points at a known AI image service or CDN.',
    run(ctx) {
      return sources(ctx).filter((s) => AI_HOSTS.test(s.url)).slice(0, 10).map((s) => ({ el: s.el, detail: U.snippet(s.url, 80) }));
    },
  });

  R({
    id: 'img-generated-name', cat: 'image', sev: 2,
    title: 'Generator-style filename',
    why: 'Filenames like "ChatGPT Image …", "Gemini_Generated_Image_…" or "DALL-E …" survive when people upload raw outputs.',
    run(ctx) {
      return sources(ctx).filter((s) => {
        const file = decodeURIComponent(s.url.split('?')[0].split('/').pop() || '');
        return GENERATED_NAMES.test(file);
      }).slice(0, 10).map((s) => ({ el: s.el, detail: U.snippet(decodeURIComponent(s.url.split('?')[0].split('/').pop()), 70) }));
    },
  });

  R({
    id: 'img-placeholder', cat: 'image', sev: 2,
    title: 'Stock, placeholder or fake-avatar images',
    why: 'Picsum, Unsplash source, randomuser or pravatar are the default fillers for generated mockups.',
    run(ctx) {
      return sources(ctx).filter((s) => PLACEHOLDER_HOSTS.test(s.url)).slice(0, 10).map((s) => ({ el: s.el, detail: U.snippet(s.url, 80) }));
    },
  });

  R({
    id: 'img-alt', cat: 'image', sev: 1,
    title: 'Missing or generic alt text',
    why: 'Generated pages often omit alt text, or use "image" / "hero" / "photo".',
    run(ctx) {
      const out = [];
      for (const img of document.images) {
        if (out.length >= 10) break;
        const r = img.getBoundingClientRect();
        if (r.width < 60 || r.height < 60) continue;
        if (img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true') continue;
        const alt = img.getAttribute('alt');
        if (alt === null) out.push({ el: img, detail: 'No alt attribute', fix: () => img.setAttribute('alt', '') });
        else if (/^(image|photo|picture|hero|img|banner|screenshot|placeholder)\d*$/i.test(alt.trim())) out.push({ el: img, detail: `Generic alt: "${alt}"` });
      }
      return out;
    },
  });

  R({
    id: 'img-smooth-gradient', cat: 'image', sev: 1,
    title: 'Smooth gradient / blob image',
    why: 'Large images with almost no local detail are typically generated mesh gradients or orbs.',
    run(ctx) {
      const out = [];
      for (const img of document.images) {
        if (out.length >= 5) break;
        const r = img.getBoundingClientRect();
        if (r.width < 200 || r.height < 120 || !img.complete || !img.naturalWidth) continue;
        try {
          const c = document.createElement('canvas');
          c.width = 32; c.height = 32;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(img, 0, 0, 32, 32);
          const d = g.getImageData(0, 0, 32, 32).data;
          let diff = 0, count = 0, lo = 255, hi = 0;
          for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 31; x++) {
              const i = (y * 32 + x) * 4, j = i + 4;
              diff += Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
              count += 3;
              lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]);
            }
          }
          const avg = diff / count;
          if (avg < 3 && hi - lo > 40) out.push({ el: img, detail: `Avg neighbour difference ${avg.toFixed(1)}/255 with wide colour range` });
        } catch (e) { /* cross-origin canvas taint: skip */ }
      }
      return out;
    },
  });
})();
