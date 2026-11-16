// Test E2E + responsywność (Playwright). Uruchom: aplikację (npm run build && npm start), potem
//   npx playwright install chromium && ADMIN_PASSWORD=... node e2e/smoke.js
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
(async () => {
  require('fs').mkdirSync(process.env.SHOTS_DIR || './e2e/shots', { recursive: true });
  const b = await chromium.launch(); const out = (process.env.SHOTS_DIR || './e2e/shots') + '/';
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.goto(BASE + '/'); await p.screenshot({ path: out + 'home.png' });
  await p.goto(BASE + '/rejestracja');
  const email = `e2e${Date.now()}@test.pl`;
  await p.fill('#name', 'Tester'); await p.fill('#email', email); await p.fill('#password', 'bardzo-dlugie-haslo');
  await p.click('button:has-text("Utwórz konto")'); await p.waitForURL('**/panel');
  await p.goto(BASE + '/panel/zamow'); await p.fill('#sname', 'E2E Serwer'); await p.click('button:has-text("Przejdź do płatności")');
  await p.waitForURL('**/panel/zamowienia/*'); await p.click('button:has-text("Symuluj płatność")');
  await p.waitForSelector('text=Przejdź do serwera'); await p.click('text=Przejdź do serwera');
  await p.waitForURL('**/panel/serwery/*'); await p.click('button:has-text("Start")'); await p.waitForSelector('text=Działa');
  await p.screenshot({ path: out + 'server.png' });
  await p.click('a:has-text("Statystyki")'); await p.waitForSelector('text=CPU —', { timeout: 10000 }); await p.screenshot({ path: out + 'stats.png' });
  await p.goto(BASE + '/admin'); console.log('klient na /admin ->', p.url());
  const m = await b.newContext({ viewport: { width: 390, height: 800 } }); const mp = await m.newPage();
  await mp.goto(BASE + '/'); const sw = await mp.evaluate(() => document.documentElement.scrollWidth); console.log('mobile scrollWidth', sw);
  await mp.screenshot({ path: out + 'mobile.png' });
  await mp.goto(BASE + '/oferta'); console.log('oferta mobile scrollWidth', await mp.evaluate(() => document.documentElement.scrollWidth));
  const a = await b.newContext({ viewport: { width: 1280, height: 800 } }); const ap = await a.newPage();
  await ap.goto(BASE + '/logowanie'); await ap.fill('#email', 'admin@gamecontrol.local'); await ap.fill('#password', process.env.ADMIN_PASSWORD); await ap.click('button:has-text("Zaloguj")'); await ap.waitForURL('**/admin');
  for (const r of ['', '/cennik', '/wezly', '/audyt', '/serwery', '/zamowienia', '/platnosci', '/klienci', '/pracownicy']) { const resp = await ap.goto(BASE + '/admin' + r); console.log('admin' + r, resp.status()); }
  await ap.goto(BASE + '/admin'); await ap.screenshot({ path: out + 'admin.png' });
  console.log('JS errors:', errs); if (errs.length || sw > 390) process.exitCode = 1; await b.close();
})();
