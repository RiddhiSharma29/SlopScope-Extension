// Headless batch scanner. Injects the same rule files the extension uses and writes a CSV.
// Usage: node benchmark.mjs urls.txt results.csv
// urls.txt: one URL per line, optional "<url> ai" or "<url> human" label.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'extension', 'src');
const files = ['util.js', 'rules/ui.js', 'rules/text.js', 'rules/image.js', 'rules/code.js', 'score.js', 'scanner.js'].map((f) => path.join(src, f));

const [inFile = 'urls.txt', outFile = 'results.csv'] = process.argv.slice(2);
const lines = fs.readFileSync(inFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const browser = await chromium.launch();
const rows = [['url', 'label', 'score', 'ui', 'text', 'image', 'code', 'findings', 'error']];
for (const line of lines) {
  const [url, label = ''] = line.split(/\s+/);
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    for (const f of files) await page.addScriptTag({ path: f });
    const r = await page.evaluate(() => window.SlopScope.scan());
    const c = r.score.categories;
    rows.push([url, label, r.score.overall, c.ui, c.text, c.image, c.code, r.totalFindings, '']);
    console.log(`${String(r.score.overall).padStart(3)}  ${label.padEnd(6)} ${url}`);
  } catch (e) {
    rows.push([url, label, '', '', '', '', '', '', String(e.message).split('\n')[0]]);
    console.log(`ERR  ${url}: ${e.message.split('\n')[0]}`);
  }
  await page.close();
}
await browser.close();

const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
fs.writeFileSync(outFile, rows.map((r) => r.map(esc).join(',')).join('\n'));

// Quick precision/recall at threshold 40 if labels are present.
const labelled = rows.slice(1).filter((r) => (r[1] === 'ai' || r[1] === 'human') && r[2] !== '');
if (labelled.length) {
  const T = 40;
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of labelled) {
    const pred = Number(r[2]) >= T, truth = r[1] === 'ai';
    if (pred && truth) tp++; else if (pred && !truth) fp++; else if (!pred && truth) fn++; else tn++;
  }
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
  console.log(`\nThreshold ${T}: TP ${tp} FP ${fp} FN ${fn} TN ${tn}  precision ${precision.toFixed(2)}  recall ${recall.toFixed(2)}  F1 ${(2 * precision * recall / (precision + recall || 1)).toFixed(2)}`);
}
console.log(`\nWrote ${outFile}`);
