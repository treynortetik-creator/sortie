// End-to-end tour of the real app in headless Chrome at iPhone size. Produces docs/screenshots/*.png,
// docs/screenshots/flow.gif, docs/samples/*.csv and exits non-zero if the flow breaks.
//   Needs: Google Chrome (CHROME_PATH to override), ImageMagick, ffmpeg, a built app (`npm run build`)
//   and OPENROUTER_API_KEY in .env.local. Spends about half a cent.
import puppeteer, { KnownDevices } from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fx = join(root, 'test', 'fixtures');
const shots = join(root, 'docs', 'screenshots');
const samples = join(root, 'docs', 'samples');
const verification = join(root, 'docs', 'verification');
for (const d of [shots, samples, verification]) mkdirSync(d, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'sortie-e2e-'));
const PORT = Number(process.env.E2E_PORT || 3218);
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- fake camera and microphone -------------------------------------------------------------
// A portrait "camera" feed of a badge on a table, and the recorded voice note as the microphone.
execFileSync('magick', [join(fx, 'camera-priya.jpg'), '-resize', '720x1280!', join(work, 'cam.jpg')]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', join(work, 'cam.jpg'), '-t', '2', '-r', '10', '-pix_fmt', 'yuvj420p', '-c:v', 'mjpeg', join(work, 'cam.mjpeg')]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(fx, 'voice-note.m4a'), '-ar', '48000', '-ac', '1', join(work, 'mic.wav')]);

// --- server (own process so we can kill it to test true offline) -----------------------------
let server = null;
const costLines = [];
function startServer() {
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  server.stdout.on('data', (d) => {
    for (const line of String(d).split('\n')) if (line.includes('sortie.cost')) { costLines.push(line.trim()); }
  });
  return waitFor(async () => (await fetch(`${BASE}/api/status`).then((r) => r.ok).catch(() => false)), 30_000, 'server start');
}
function stopServer() {
  if (!server) return;
  const s = server;
  server = null;
  try { process.kill(-s.pid); } catch { /* not a group leader */ }
  s.kill('SIGTERM');
  // next start spawns a child; make sure the port is free before returning.
  return waitFor(async () => !(await fetch(`${BASE}/api/status`).then((r) => r.ok).catch(() => false)), 15_000, 'server stop');
}
async function waitFor(fn, ms, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return;
    await sleep(150);
  }
  throw new Error(`Timed out: ${what}`);
}

let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
}

const frames = [];
async function shot(page, name, gif = false) {
  const path = join(shots, `${name}.png`);
  await page.screenshot({ path });
  if (gif) frames.push(path);
}

// ---------------------------------------------------------------------------------------------
await startServer();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${join(work, 'cam.mjpeg')}`,
    `--use-file-for-fake-audio-capture=${join(work, 'mic.wav')}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
let page;
try {
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE, ['camera', 'microphone']);
  page = await browser.newPage();
  await page.emulate(KnownDevices['iPhone 15 Pro']);
  // Installed PWAs get the full screen (no Safari toolbars).
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'canShare', { value: undefined }); });
  const cdp = await page.createCDPSession();
  const dl = join(work, 'downloads');
  mkdirSync(dl);
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const click = async (selector) => { const el = await page.waitForSelector(selector, { visible: true, timeout: 15_000 }); await el.click(); };
  const clickText = async (tag, text) => {
    const h = await page.waitForFunction((tag, text) => [...document.querySelectorAll(tag)].find((e) => e.textContent.trim().includes(text) && e.offsetParent !== null), { timeout: 15_000 }, tag, text);
    await h.asElement().click();
  };
  const val = (sel) => page.$eval(sel, (e) => e.value).catch(() => '');
  const filled = (sel) => waitFor(async () => (await val(sel)).length > 0, 25_000, `field ${sel} to fill`);

  // 1. First run
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#new-event');
  await shot(page, '01-first-run');
  await page.type('#new-event', 'FieldCon 2026');
  await clickText('button', 'Start capturing');

  // 2. Camera
  await page.waitForSelector('button[aria-label="Take photo"]:not([disabled])', { timeout: 15_000 });
  await sleep(600);
  await shot(page, '02-camera', true);

  // 3. Snap -> sheet with "reading" state -> extracted
  await click('button[aria-label="Take photo"]');
  await page.waitForSelector('#f-firstName');
  await sleep(450);
  await shot(page, '03-reading', true);
  await filled('#f-firstName');
  await sleep(300);
  check((await val('#f-firstName')) === 'Priya' && (await val('#f-lastName')) === 'Raghunathan', 'camera capture: name filled from the badge');
  check((await val('#f-company')) === 'Northwind Analytics', 'camera capture: company filled');
  await shot(page, '04-extracted', true);

  // 4. Voice note (fake mic plays the recorded file), real transcription
  await click('button[aria-label="Record voice note"]');
  await sleep(300);
  await shot(page, '05-recording', true);
  await sleep(3500);
  await click('button[aria-label="Stop recording"]');
  await page.waitForSelector('textarea[id^="tr-"]', { timeout: 40_000 });
  await waitFor(async () => ((await page.$eval('textarea[id^="tr-"]', (e) => e.value)) || '').length > 5, 40_000, 'transcript');
  const transcript = await page.$eval('textarea[id^="tr-"]', (e) => e.value);
  check(/field marketing|demo|great/i.test(transcript), `voice note transcribed: "${transcript.slice(0, 60)}..."`);
  await page.evaluate(() => document.querySelector('[role="dialog"] .overflow-y-auto').scrollTo(0, 99999));
  await clickText('button', 'Hot');
  await sleep(200);
  await shot(page, '06-voice-saved', true);
  await clickText('button', 'Save & next');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  await sleep(500);
  await shot(page, '07-saved-next', true);

  // 5. More captures through the photo-library path
  async function viaLibrary(file) {
    const [chooser] = await Promise.all([page.waitForFileChooser(), click('button[aria-label="Choose photo from library"]')]);
    await chooser.accept([join(fx, file)]);
    await page.waitForSelector('#f-firstName');
  }
  for (const [file, first] of [['card-marcus.jpg', 'Marcus'], ['badge-zoe.jpg', 'Zoë'], ['card-soren.jpg', 'Søren']]) {
    await viaLibrary(file);
    await filled('#f-firstName');
    await sleep(300);
    check((await val('#f-firstName')) === first, `library capture ${file}: first name "${first}"`);
    if (file === 'card-marcus.jpg') { await shot(page, '08-card-extracted'); await page.evaluate(() => document.querySelector('[role="dialog"] .overflow-y-auto').scrollTo(0, 99999)); await clickText('button', 'Warm'); }
    await clickText('button', 'Save & next');
    await page.waitForSelector('[role="dialog"]', { hidden: true });
    await sleep(300);
  }

  // 6. Duplicate scan of the same badge
  await viaLibrary('badge-priya.jpg');
  await filled('#f-firstName');
  await page.waitForFunction(() => document.body.innerText.includes('Looks like'), { timeout: 10_000 });
  check(true, 'duplicate badge flagged in the sheet');
  await shot(page, '09-duplicate', true);
  await clickText('button', 'Merge');
  await page.waitForSelector('[role="dialog"]', { hidden: true });

  // 7. Leads list + export
  await clickText('a', 'Leads');
  await sleep(1200);
  await page.waitForSelector('ul li a[href^="/lead?id="]');
  await sleep(500);
  const rows = await page.$$eval('ul li a[href^="/lead?id="]', (a) => a.length);
  check(rows === 4, `leads list shows 4 leads after merging the duplicate (got ${rows})`);
  await shot(page, '10-leads', true);
  await clickText('button', 'CSV');
  await page.waitForSelector('[role="dialog"]');
  await sleep(500);
  await shot(page, '11-export', true);
  async function download(format, label) {
    await sleep(500); // let the sheet finish sliding in
    await clickText('button', label);
    const before = new Set(readdirSync(dl));
    await clickText('button', 'Download CSV');
    await waitFor(async () => readdirSync(dl).some((f) => !before.has(f) && f.endsWith('.csv')), 10_000, `${format} download`);
    const f = readdirSync(dl).find((x) => !before.has(x) && x.endsWith('.csv'));
    const text = readFileSync(join(dl, f), 'utf8');
    copyFileSync(join(dl, f), join(samples, `sample-${format}.csv`));
    await clickText('button', 'CSV');
    await page.waitForSelector('[role="dialog"]');
    return text;
  }
  const sf = await download('salesforce', 'Salesforce Leads');
  check(sf.startsWith('First Name,Last Name,Company,Title,Email,Phone,Website,Lead Source,Rating,Description\r\n'), 'Salesforce CSV header');
  check(sf.includes('Raghunathan') && sf.includes('Ødegård-Lindqvist') && sf.includes('Hot'), 'Salesforce CSV rows (accents, rating)');
  check(sf.includes('Voice note:'), 'Salesforce CSV carries the voice-note transcript');
  const hs = await download('hubspot', 'HubSpot Contacts');
  check(hs.startsWith('First Name,Last Name,Email,Phone Number,Job Title,Company Name,Website URL,Lead Status,'), 'HubSpot CSV header');
  await sleep(600);
  await click('button[aria-label="Close"]');
  await page.waitForSelector('[role="dialog"]', { hidden: true });

  // 8. Settings page
  await clickText('a', 'Settings');
  await page.waitForSelector('#key');
  await sleep(2600); // let the toast fade
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '12-settings');

  // 9. TRUE offline: service worker only, server process dead
  await clickText('a', 'Capture');
  await page.waitForSelector('button[aria-label="Take photo"]');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await sleep(1500); // let the install step finish precaching
  const cached = await page.evaluate(async () => (await (await caches.open('sortie-static')).keys()).length);
  check(cached > 5, `service worker precached ${cached} static assets`);
  await stopServer();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[aria-label="Take photo"]', { timeout: 20_000 });
  check(true, 'app shell loads with the server dead (service worker)');
  await clickText('a', 'Leads');
  await page.waitForSelector('ul li a[href^="/lead?id="]', { timeout: 20_000 });
  check(true, 'leads list opens offline from local storage');
  await clickText('a', 'Capture');
  await page.waitForSelector('button[aria-label="Take photo"]:not([disabled])');
  await click('button[aria-label="Take photo"]');
  await page.waitForSelector('#f-firstName');
  await sleep(1500);
  const dead = await page.evaluate(() => document.body.innerText);
  check(/Can.t reach the server/.test(dead), 'wifi up but server unreachable: sheet says it will retry');
  // Airplane mode: the browser reports offline.
  const airplane = (on) => page.evaluate((on) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !on });
    window.dispatchEvent(new Event(on ? 'offline' : 'online'));
  }, on);
  await airplane(true);
  await sleep(600);
  await shot(page, '13-offline-capture', true);
  const banner = await page.evaluate(() => document.body.innerText);
  check(/Offline/.test(banner), 'airplane mode: offline banner and pill shown');
  await page.type('#f-lastName', 'Typed-Offline');
  await clickText('button', 'Save & next');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  await sleep(400);
  await shot(page, '14-offline-queued', true);
  const pill = await page.evaluate(() => document.querySelector('header')?.innerText ?? '');
  check(/Offline · 1 waiting/.test(pill), `pill shows the queued capture ("${pill.replace(/\n/g, ' ')}")`);

  // 10. Back online: queue drains by itself
  await startServer();
  await airplane(false);
  await clickText('a', 'Leads');
  await page.waitForSelector('ul li a[href^="/lead?id="]');
  await waitFor(async () => (await page.evaluate(() => document.body.innerText)).includes('Priya Typed-Offline'), 60_000, 'queued capture to be read after reconnect');
  await waitFor(async () => /Synced/.test(await page.evaluate(() => document.body.innerText)), 20_000, 'pill to say Synced');
  check(true, 'reconnect: the queued capture was read automatically, kept the typed last name, and the pill says Synced');
  const rows2 = await page.$$eval('ul li a[href^="/lead?id="]', (a) => a.length);
  check(rows2 === 5, `5 leads after the offline capture synced (got ${rows2})`);
  await shot(page, '15-back-online', true);

  const realErrors = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
  check(realErrors.length === 0, `no console errors (${realErrors.slice(0, 3).join(' | ') || 'clean'})`);

  // GIF
  if (frames.length) {
    execFileSync('magick', ['-delay', '110', '-loop', '0', ...frames.flatMap((f) => [f, '-resize', '300x']).slice(0), '-layers', 'Optimize', join(shots, 'flow.gif')]);
  }
} catch (e) {
  if (page) {
    await page.screenshot({ path: join(tmpdir(), 'sortie-e2e-failure.png') }).catch(() => {});
    console.log('PAGE TEXT AT FAILURE:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 600));
    console.log('screenshot: ' + join(tmpdir(), 'sortie-e2e-failure.png'));
  }
  failures++;
  console.error(e.message);
} finally {
  await browser.close();
  await stopServer();
  if (costLines.length) appendFileSync(join(verification, 'cost-log.jsonl'), costLines.join('\n') + '\n');
  rmSync(work, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
