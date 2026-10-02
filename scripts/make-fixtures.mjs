// Renders synthetic badge / business-card photos with FAKE people and companies.
// Output: test/fixtures/*.jpg + test/fixtures/truth.json (ground truth for scoring).
// Needs: Google Chrome (CHROME_PATH to override) and ImageMagick (`magick`).
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test', 'fixtures');
mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const base = `
  *{box-sizing:border-box;margin:0}
  body{width:1600px;height:1200px;display:flex;align-items:center;justify-content:center;
       background:radial-gradient(circle at 30% 20%,#c9b99a,#8d7b5e 70%);font-family:'Helvetica Neue',Arial,sans-serif;overflow:hidden}
  .qr{width:150px;height:150px;background:
      conic-gradient(#111 25%,#fff 0 50%,#111 0 75%,#fff 0) 0 0/30px 30px;border:10px solid #fff;outline:3px solid #111}
`;

const items = [
  {
    file: 'badge-priya',
    truth: { firstName: 'Priya', lastName: 'Raghunathan', title: 'Director, Field Marketing', company: 'Northwind Analytics', email: '', phone: '' },
    css: `.t{transform:rotate(-3deg) perspective(1800px) rotateY(6deg)}
      .badge{width:760px;height:1020px;background:#fff;border-radius:26px;box-shadow:0 40px 60px rgba(0,0,0,.45);overflow:hidden;position:relative;text-align:center}
      .top{background:#1d3557;color:#fff;padding:46px;font-size:34px;letter-spacing:6px;font-weight:700}
      .hole{position:absolute;top:18px;left:50%;width:120px;height:18px;margin-left:-60px;background:#8d7b5e;border-radius:9px}
      .name{font-size:96px;font-weight:800;margin-top:150px;line-height:1.05;color:#111}
      .title{font-size:36px;margin-top:34px;color:#333}
      .co{font-size:50px;font-weight:700;margin-top:26px;color:#1d3557}
      .rib{position:absolute;bottom:0;left:0;right:0;background:#e63946;color:#fff;font-size:56px;font-weight:800;padding:34px;letter-spacing:8px}
      .qr{position:absolute;right:40px;bottom:170px;width:130px;height:130px}`,
    html: `<div class="t"><div class="badge"><div class="hole"></div><div class="top">FIELDCON 2026</div>
      <div class="name">PRIYA<br>RAGHUNATHAN</div><div class="title">Director, Field Marketing</div>
      <div class="co">Northwind Analytics</div><div class="qr"></div><div class="rib">ATTENDEE</div></div></div>`,
    post: ['-attenuate', '0.25', '+noise', 'Gaussian', '-blur', '0x0.6'],
  },
  {
    file: 'card-marcus',
    truth: { firstName: 'Marcus', lastName: 'Delacroix-Bell', title: 'VP, Partnerships', company: 'Halcyon Freight Systems', email: 'marcus.bell@halcyonfreight.example', phone: '+1 (415) 555-0142' },
    css: `.t{transform:rotate(7deg) perspective(1800px) rotateX(8deg)}
      .card{width:1100px;height:630px;background:linear-gradient(135deg,#fafaf7,#ecebe4);box-shadow:0 30px 50px rgba(0,0,0,.5);padding:56px 70px;position:relative}
      .bar{position:absolute;left:0;top:0;bottom:0;width:26px;background:#0b6e4f}
      .co{font-size:30px;letter-spacing:5px;color:#0b6e4f;font-weight:700;text-transform:uppercase}
      .name{font-size:76px;font-weight:700;margin-top:70px;color:#1a1a1a;font-family:Georgia,serif}
      .title{font-size:36px;color:#555;margin-top:8px}
      .info{position:absolute;bottom:50px;left:70px;font-size:32px;line-height:1.55;color:#222}
      .addr{position:absolute;bottom:50px;right:70px;text-align:right;font-size:26px;color:#666;line-height:1.5}`,
    html: `<div class="t"><div class="card"><div class="bar"></div><div class="co">Halcyon Freight Systems</div>
      <div class="name">Marcus Delacroix-Bell</div><div class="title">VP, Partnerships</div>
      <div class="info">T  +1 (415) 555-0142<br>E  marcus.bell@halcyonfreight.example<br>W  halcyonfreight.example</div>
      <div class="addr">88 Harbor Street, Suite 400<br>Oakland, CA 94607</div></div></div>`,
    post: ['-attenuate', '0.2', '+noise', 'Gaussian', '-brightness-contrast', '-5x8'],
  },
  {
    file: 'badge-zoe',
    truth: { firstName: 'Zoë', lastName: 'Müller-Ålesund', title: '', company: 'Birchwood & Finch', email: '', phone: '' },
    css: `.t{transform:rotate(2deg) perspective(1400px) rotateY(-9deg) rotateX(4deg)}
      .badge{width:900px;height:640px;background:#f4f1ea;border-radius:20px;box-shadow:0 36px 56px rgba(0,0,0,.5);position:relative;padding:50px 60px;border-top:44px solid #f4a261}
      .hello{font-size:30px;letter-spacing:6px;color:#777}
      .first{font-size:150px;font-weight:800;line-height:1;margin-top:20px;color:#111}
      .last{font-size:62px;font-weight:600;color:#222;margin-top:6px}
      .co{position:absolute;bottom:46px;left:60px;font-size:46px;font-weight:700;color:#264653}
      .tag{position:absolute;right:50px;bottom:46px;font-size:26px;background:#264653;color:#fff;padding:10px 20px;border-radius:8px}`,
    html: `<div class="t"><div class="badge"><div class="hello">HELLO, MY NAME IS</div><div class="first">Zoë</div>
      <div class="last">Müller-Ålesund</div><div class="co">Birchwood &amp; Finch</div><div class="tag">EXHIBITOR</div></div></div>`,
    post: ['-attenuate', '0.3', '+noise', 'Gaussian', '-blur', '0x1.1'],
  },
  {
    file: 'card-soren',
    truth: { firstName: 'Søren', lastName: 'Ødegård-Lindqvist', title: 'Chief Medical Officer', company: 'Lumen Care Collective', email: 'soren@lumencare.example', phone: '+46 8 555 01 77' },
    css: `.t{transform:rotate(-8deg) perspective(1600px) rotateX(10deg) rotateY(5deg)}
      .card{width:1050px;height:600px;background:linear-gradient(160deg,#1f2933,#0f1720);box-shadow:0 30px 50px rgba(0,0,0,.6);padding:54px 64px;color:#e8e6df;position:relative;overflow:hidden}
      .glare{position:absolute;top:-200px;left:300px;width:300px;height:1000px;background:rgba(255,255,255,.12);transform:rotate(25deg)}
      .dr{font-size:30px;color:#c9a227;letter-spacing:4px}
      .name{font-size:62px;font-weight:600;margin-top:14px;font-family:Georgia,serif}
      .title{font-size:34px;color:#c9a227;margin-top:10px}
      .co{font-size:40px;margin-top:34px;font-weight:700}
      .info{position:absolute;bottom:44px;left:64px;font-size:30px;line-height:1.55;color:#cfcdc6}`,
    html: `<div class="t"><div class="card"><div class="glare"></div><div class="dr">DR.</div>
      <div class="name">Søren Ødegård-Lindqvist</div><div class="title">Chief Medical Officer</div>
      <div class="co">Lumen Care Collective</div>
      <div class="info">+46 8 555 01 77<br>soren@lumencare.example</div></div></div>`,
    post: ['-blur', '0x2.2', '-attenuate', '0.35', '+noise', 'Gaussian'],
  },
  {
    file: 'badge-ayodele',
    truth: { firstName: 'Ayodele', lastName: 'Okonkwo-Reyes', title: 'Head of Events', company: 'Cobalt & Quill Media', email: '', phone: '' },
    css: `.t{transform:rotate(-1.5deg) perspective(1600px) rotateY(-4deg)}
      .badge{width:640px;height:980px;background:#fff;border-radius:22px;box-shadow:0 40px 60px rgba(0,0,0,.45);text-align:center;position:relative;overflow:hidden}
      .logo{margin-top:70px;font-size:38px;font-weight:800;color:#6a4c93;letter-spacing:2px}
      .wave{height:16px;background:#6a4c93;margin:30px 0}
      .name{font-size:68px;font-weight:800;line-height:1.1;margin-top:100px;color:#111;padding:0 30px}
      .title{font-size:34px;margin-top:30px;color:#444}
      .co{font-size:40px;font-weight:700;margin-top:18px;color:#6a4c93}
      .type{position:absolute;bottom:0;left:0;right:0;background:#111;color:#ffca3a;font-size:48px;font-weight:800;padding:34px;letter-spacing:6px}`,
    html: `<div class="t"><div class="badge"><div class="logo">SUMMIT / 26</div><div class="wave"></div>
      <div class="name">Ayodele<br>Okonkwo-Reyes</div><div class="title">Head of Events</div>
      <div class="co">Cobalt &amp; Quill Media</div><div class="type">SPEAKER</div></div></div>`,
    post: ['-attenuate', '0.2', '+noise', 'Gaussian', '-blur', '0x0.8'],
  },
  {
    // HARD: dim room, motion blur, steep tilt, glare. Booth reality.
    file: 'hard-badge-dim',
    truth: { firstName: 'Imani', lastName: 'Whitfield-Osei', title: 'Sr. Manager, Partner Programs', company: 'Tidewater Robotics', email: '', phone: '' },
    css: `body{background:radial-gradient(circle at 70% 30%,#2b2a28,#0e0d0c 75%)}
      .t{transform:rotate(19deg) perspective(1200px) rotateY(-24deg) rotateX(12deg)}
      .badge{width:700px;height:900px;background:#d9d6cf;border-radius:22px;text-align:center;position:relative;overflow:hidden;box-shadow:0 30px 50px rgba(0,0,0,.7)}
      .top{background:#3a3a3a;color:#ddd;padding:38px;font-size:30px;letter-spacing:5px;font-weight:700}
      .name{font-size:70px;font-weight:800;margin-top:120px;line-height:1.08;color:#1a1a1a}
      .title{font-size:30px;margin-top:30px;color:#333}
      .co{font-size:40px;font-weight:700;margin-top:18px;color:#7a1f1f}
      .glare{position:absolute;top:-100px;left:360px;width:160px;height:1200px;background:rgba(255,255,255,.35);transform:rotate(22deg)}
      .rib{position:absolute;bottom:0;left:0;right:0;background:#222;color:#bbb;font-size:44px;font-weight:800;padding:28px;letter-spacing:6px}`,
    html: `<div class="t"><div class="badge"><div class="top">SUMMIT / 26</div><div class="name">Imani<br>Whitfield-Osei</div>
      <div class="title">Sr. Manager, Partner Programs</div><div class="co">Tidewater Robotics</div><div class="glare"></div><div class="rib">EXHIBITOR</div></div></div>`,
    post: ['-motion-blur', '0x7+25', '-attenuate', '0.5', '+noise', 'Gaussian', '-brightness-contrast', '-18x-6', '-resize', '70%', '-resize', '143%'],
    hard: true,
  },
  {
    // HARD: crowded card, two-line title, ampersand company, several contact lines.
    file: 'hard-card-busy',
    truth: { firstName: 'Rafael', lastName: 'Quintanilla-Ng', title: 'Senior Vice President, Global Customer Success', company: 'Marlowe & Pryce Advisory', email: 'rafael.ng@marlowepryce.example', phone: '+44 20 7946 0958' },
    css: `.t{transform:rotate(-12deg) perspective(1500px) rotateX(14deg) rotateY(-6deg)}
      .card{width:1100px;height:640px;background:#f3efe4;box-shadow:0 30px 50px rgba(0,0,0,.5);padding:44px 56px;position:relative;font-family:Georgia,serif}
      .logo{position:absolute;top:40px;right:56px;width:110px;height:110px;border-radius:50%;background:#8c2f39;color:#f3efe4;font:700 44px Arial;display:grid;place-items:center}
      .co{font:700 26px Arial;letter-spacing:3px;color:#8c2f39;text-transform:uppercase}
      .name{font-size:58px;margin-top:70px;color:#1b1b1b}
      .title{font:30px Arial;color:#444;margin-top:8px;line-height:1.25;max-width:640px}
      .info{position:absolute;bottom:40px;left:56px;font:25px/1.5 Arial;color:#222}
      .addr{position:absolute;bottom:40px;right:56px;text-align:right;font:21px/1.45 Arial;color:#666}`,
    html: `<div class="t"><div class="card"><div class="logo">M&amp;P</div><div class="co">Marlowe &amp; Pryce Advisory</div>
      <div class="name">Rafael Quintanilla-Ng</div><div class="title">Senior Vice President,<br>Global Customer Success</div>
      <div class="info">Direct  +44 20 7946 0958<br>rafael.ng@marlowepryce.example<br>www.marlowepryce.example &nbsp;|&nbsp; in/rafaelng-demo</div>
      <div class="addr">14 Cheapside<br>London EC2V 6DN<br>United Kingdom</div></div></div>`,
    post: ['-attenuate', '0.3', '+noise', 'Gaussian', '-blur', '0x1.3'],
    hard: true,
  },
  {
    // HARD: low resolution, heavy rotation, lanyard in the way.
    file: 'hard-badge-lowres',
    truth: { firstName: 'Nikolai', lastName: 'Sørensen', title: 'Head of Field Events', company: 'Verdant Grid', email: '', phone: '' },
    css: `.t{transform:rotate(-34deg) perspective(1400px) rotateY(10deg)}
      .badge{width:620px;height:880px;background:#fff;border-radius:18px;text-align:center;position:relative;overflow:hidden;box-shadow:0 30px 50px rgba(0,0,0,.5)}
      .lan{position:absolute;top:-40px;left:230px;width:160px;height:220px;background:#0b6e4f;opacity:.92}
      .name{font-size:62px;font-weight:800;margin-top:250px;line-height:1.1;color:#111}
      .title{font-size:30px;margin-top:26px;color:#333}
      .co{font-size:38px;font-weight:700;margin-top:16px;color:#0b6e4f}
      .rib{position:absolute;bottom:0;left:0;right:0;background:#0b6e4f;color:#fff;font-size:44px;font-weight:800;padding:28px;letter-spacing:6px}`,
    html: `<div class="t"><div class="badge"><div class="lan"></div><div class="name">Nikolai<br>Sørensen</div>
      <div class="title">Head of Field Events</div><div class="co">Verdant Grid</div><div class="rib">VIP</div></div></div>`,
    post: ['-resize', '50%', '-blur', '0x0.7', '-resize', '200%', '-quality', '35'],
    hard: true,
  },
  {
    // Not scored: the portrait "camera view" used by the screenshot tour's fake camera.
    file: 'camera-priya',
    scene: true,
    viewport: { width: 900, height: 1600 },
    css: `body{width:900px;height:1600px}.t{zoom:1.02;transform:rotate(-2deg) perspective(1800px) rotateY(4deg)}
      .badge{width:760px;height:1020px;background:#fff;border-radius:26px;box-shadow:0 40px 60px rgba(0,0,0,.45);overflow:hidden;position:relative;text-align:center}
      .top{background:#1d3557;color:#fff;padding:46px;font-size:34px;letter-spacing:6px;font-weight:700}
      .hole{position:absolute;top:18px;left:50%;width:120px;height:18px;margin-left:-60px;background:#8d7b5e;border-radius:9px}
      .name{font-size:96px;font-weight:800;margin-top:150px;line-height:1.05;color:#111}
      .title{font-size:36px;margin-top:34px;color:#333}
      .co{font-size:50px;font-weight:700;margin-top:26px;color:#1d3557}
      .rib{position:absolute;bottom:0;left:0;right:0;background:#e63946;color:#fff;font-size:56px;font-weight:800;padding:34px;letter-spacing:8px}
      .qr{position:absolute;right:40px;bottom:170px;width:130px;height:130px}`,
    html: `<div class="t"><div class="badge"><div class="hole"></div><div class="top">FIELDCON 2026</div>
      <div class="name">PRIYA<br>RAGHUNATHAN</div><div class="title">Director, Field Marketing</div>
      <div class="co">Northwind Analytics</div><div class="qr"></div><div class="rib">ATTENDEE</div></div></div>`,
    post: ['-attenuate', '0.2', '+noise', 'Gaussian', '-blur', '0x0.5'],
  },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const truth = {};
try {
  for (const it of items) {
    const page = await browser.newPage();
    await page.setViewport(it.viewport ?? { width: 1600, height: 1200 });
    await page.setContent(`<html><head><style>${base}${it.css}</style></head><body>${it.html}</body></html>`);
    const png = join(out, `${it.file}.png`);
    await page.screenshot({ path: png });
    await page.close();
    const jpg = join(out, `${it.file}.jpg`);
    execFileSync('magick', [png, ...it.post, '-quality', it.hard ? '45' : '78', '-resize', '1400x1600>', jpg]);
    rmSync(png);
    if (!it.scene) truth[`${it.file}.jpg`] = { ...it.truth };
    console.log('wrote', jpg);
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, 'truth.json'), JSON.stringify(truth, null, 2) + '\n');
if (!existsSync(join(out, 'truth.json'))) process.exit(1);
