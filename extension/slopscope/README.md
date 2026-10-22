# SlopScope

Browser extension + dashboard that finds "AI slop" on any web page across four categories: **UI, text, images, code**. It scores the page 0-100, highlights the offenders, can preview fixes, and keeps a history you can rank and compare.

Inspired by [Impeccable](https://github.com/pbakaus/impeccable). All rules here are written from scratch.

## Run it (2 minutes)

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → choose the `extension/` folder.
3. Open any normal web page, **reload it once** (content scripts attach on page load), click the SlopScope icon.
4. Use **Locate**, **Fix**, **Fix all**, **Overlay**; open **Dashboard** to see history, ranking and comparison.

Won't work on `chrome://` pages, the Chrome Web Store or PDFs.

## Layout

```
extension/
  manifest.json
  src/util.js            colour, contrast, selector helpers
  src/rules/ui.js        19 visual rules
  src/rules/text.js      8 copy rules
  src/rules/image.js     5 image rules
  src/rules/code.js      6 source rules
  src/score.js           scoring formula
  src/scanner.js         runs rules, draws overlay, applies fixes
  src/background.js      saves scan history
  popup/                 per-page results
  dashboard/             history, Hall of Slop, compare, export/import
demo/                    two offline test pages (sloppy.html, clean.html)
tools/benchmark.mjs      headless batch scanner (Playwright) → CSV
PLAN.md                  10-day plan, demo script, viva prep
```

## Add a rule (the main thing you'll do)

In any file under `src/rules/`:

```js
R({
  id: 'ui-my-rule', cat: 'ui', sev: 2,            // sev 1-3
  title: 'Short name',
  why: 'One sentence you can say out loud in the viva.',
  run(ctx) {
    // ctx.els, ctx.cs(el), ctx.vis(el), ctx.textNodes, ctx.text, ctx.cssRules
    return [{ el, detail: 'what was found', fix: () => { /* optional live fix */ } }];
  },
});
```

Return `[]` for no findings. Findings without `el` are page-level. Reload the extension, rescan.

## Benchmark

```
cd tools
npm init -y && npm i playwright && npx playwright install chromium
# put one URL per line in urls.txt (optional second column: label ai|human)
node benchmark.mjs urls.txt results.csv
```

## Safety notes

- All page-derived text is written with `textContent`, never `innerHTML`.
- Nothing leaves your machine. History lives in `chrome.storage.local`.
- Fixes change the live DOM only; reload to undo.
