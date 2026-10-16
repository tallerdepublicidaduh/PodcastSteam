const { test, expect, _electron: electron } = require('@playwright/test');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

// A real, decodable 90-second PCM stream. No external podcast or audio device required.
function makeWav() {
  const length = 8000 * 90 * 2;
  const wav = Buffer.alloc(44 + length);
  wav.write('RIFF'); wav.writeUInt32LE(36 + length, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length, 40);
  for (let i = 0; i < length / 2; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / 8000) * 100), 44 + i * 2);
  return wav;
}

test('RSS → audio en segundo plano → persistencia → reanudación', async ({}, testInfo) => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'podcaststeam-e2e-'));
  const wav = makeWav();
  const server = http.createServer((req, res) => {
    if (req.url === '/feed' || req.url === '/feed-tech') {
      res.setHeader('Content-Type', 'application/rss+xml');
      const tech = req.url === '/feed-tech';
      res.end(`<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><itunes:category text="${tech ? 'Technology' : 'Science'}"/><title>${tech ? 'Tecnología de prueba' : 'Historias de prueba'}</title><description>Podcast local</description><item><title>${tech ? 'Tecnología en partida' : 'Una partida, una historia'}</title><description><![CDATA[<script>window.injected=true</script> Un episodio de prueba]]></description><enclosure url="${base}/audio.wav?episode=${tech ? 2 : 1}" type="audio/wav"/></item></channel></rss>`);
    } else if (req.url.startsWith('/audio.wav')) {
      const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
      res.writeHead(range ? 206 : 200, { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) });
      res.end(wav.subarray(start, end + 1));
    } else { res.writeHead(404); res.end('Missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let app;
  const errors = [];
  async function launch() {
    app = await electron.launch({
      ...(process.env.PODCASTSTEAM_EXECUTABLE ? { executablePath: process.env.PODCASTSTEAM_EXECUTABLE } : {}),
      args: [...(process.env.PODCASTSTEAM_EXECUTABLE ? [] : [path.join(__dirname, '..')]), `--user-data-dir=${profile}`, '--disable-gpu'], timeout: 20000
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  try {
    let page = await launch();
    await expect(page.locator('#play')).toBeDisabled();
    await page.locator('#add-top').click();
    await page.locator('#rss-url').fill(`${base}/missing`);
    await page.locator('#submit-feed').click();
    await expect(page.locator('#form-error')).toContainText('404');
    await page.locator('#rss-url').fill(`${base}/feed`);
    await page.locator('#submit-feed').click();
    await expect(page.locator('.episode')).toHaveCount(1);
    expect(await page.evaluate(() => window.injected)).toBeUndefined();
    expect(await page.evaluate(() => typeof require)).toBe('undefined');
    await page.locator('.episode .favorite-button').click();
    await page.locator('[data-view="favorites"]').click();
    await expect(page.locator('.episode')).toHaveCount(1);
    await page.locator('.episode-play').click();
    await expect.poll(() => page.locator('#audio').evaluate(audio => !audio.paused && audio.currentTime > 0.5)).toBe(true);
    await page.locator('#player-settings').click();
    await page.locator('#forward').click();
    await expect.poll(() => page.locator('#audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(30);
    await page.locator('#back').click();
    expect(await page.locator('#audio').evaluate(audio => audio.currentTime)).toBeLessThan(20);
    await page.locator('#speed').selectOption('1.5');
    await page.locator('#volume').fill('0.35');
    expect(await page.locator('#audio').evaluate(audio => audio.volume)).toBeCloseTo(0.35);
    await page.locator('#close-player-dialog').click();
    const beforeHide = await page.locator('#audio').evaluate(audio => audio.currentTime);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    await expect.poll(() => page.locator('#audio').evaluate(audio => audio.currentTime), { timeout: 10000 }).toBeGreaterThan(beforeHide + 1.5);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.locator('#play').click();
    const position = await page.locator('#audio').evaluate(audio => audio.currentTime);
    expect(position).toBeGreaterThan(15);
    await page.screenshot({ path: testInfo.outputPath('biblioteca.png') });
    await app.close(); app = null;
    page = await launch();
    await expect(page.locator('.episode')).toHaveCount(1);
    await expect(page.locator('#now-title')).toHaveText('Una partida, una historia');
    await expect.poll(() => page.locator('#audio').evaluate(audio => audio.readyState)).toBeGreaterThanOrEqual(1);
    expect(await page.locator('#audio').evaluate(audio => audio.paused)).toBe(true);
    expect(await page.locator('#audio').evaluate(audio => audio.currentTime)).toBeCloseTo(position, 0);
    expect(await page.locator('#audio').evaluate(audio => audio.volume)).toBeCloseTo(0.35);
    expect(await page.locator('#audio').evaluate(audio => audio.playbackRate)).toBe(1.5);
    await page.locator('[data-view="favorites"]').click();
    await expect(page.locator('.episode')).toHaveCount(1);
    await page.locator('[data-view="progress"]').click();
    await expect(page.locator('.episode')).toHaveCount(1);
    await page.locator('#search').fill('no coincide');
    await expect(page.locator('.episode')).toHaveCount(0);
    await page.locator('#search').fill('');
    await page.locator('#play').click();
    await expect.poll(() => page.locator('#audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(position + 0.5);
    await page.locator('#play').click();
    await page.locator('#refresh').click();
    await expect(page.locator('#notice')).toHaveText('Biblioteca actualizada.');
    await page.evaluate(() => {
      window.testPad = { index: 0, mapping: 'standard', buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
      Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testPad] });
      window.testPad.buttons[2].pressed = true;
    });
    await expect(page.locator('#queue-count')).toHaveText('1');
    expect(await page.locator('#audio').evaluate(audio => audio.paused)).toBe(true);
    await page.evaluate(() => { window.testPad.buttons[2].pressed = false; });
    await page.locator('#search').focus();
    await page.evaluate(() => { window.testPad.buttons[15].pressed = true; });
    await expect(page.locator('#add-top')).toBeFocused();
    await page.evaluate(() => { window.testPad.buttons[15].pressed = false; });
    await page.locator('#now-title').click();
    await page.keyboard.press('Space');
    await expect.poll(() => page.locator('#audio').evaluate(audio => audio.paused)).toBe(false);
    await page.keyboard.press('Space');
    // A real animation-frame boundary gives both press and release to the poller.
    async function pressPad(index) {
      await page.evaluate(async button => {
        window.testPad.buttons[button].pressed = true;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.testPad.buttons[button].pressed = false;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, index);
    }
    await expect(page.locator('#input-mode')).toHaveText('Mando conectado');
    await page.locator('[data-view="all"]').focus();
    await pressPad(15);
    await expect(page.locator('[data-view="progress"]')).toBeFocused();
    expect(await page.locator('body').evaluate(body => body.classList.contains('using-gamepad'))).toBe(true);
    expect(await page.locator('[data-view="progress"]').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
    await pressPad(0);
    await expect(page.locator('[data-view="progress"]')).toHaveAttribute('aria-current', 'page');
    await pressPad(1);
    await expect(page.locator('[data-view="all"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('.episode .favorite-button').focus();
    await pressPad(0);
    await expect(page.locator('.episode .favorite-button')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.episode .favorite-button')).toBeFocused();
    await pressPad(0);
    await expect(page.locator('.episode .favorite-button')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#player-settings').click();
    await page.locator('#volume').focus();
    await pressPad(15);
    expect(await page.locator('#audio').evaluate(audio => audio.volume)).toBeCloseTo(0.4);
    await expect(page.locator('#volume')).toBeFocused();
    await page.locator('#volume').fill('0');
    await pressPad(14);
    expect(await page.locator('#audio').evaluate(audio => audio.volume)).toBe(0);
    await page.locator('#speed').focus();
    await pressPad(15);
    expect(await page.locator('#audio').evaluate(audio => audio.playbackRate)).toBe(2);
    await pressPad(14);
    expect(await page.locator('#audio').evaluate(audio => audio.playbackRate)).toBe(1.5);
    await pressPad(1);
    await expect(page.locator('#player-dialog')).not.toBeVisible();
    await page.locator('#add-top').focus();
    await pressPad(0);
    await expect(page.locator('#add-dialog')).toBeVisible();
    await expect(page.locator('#rss-url')).toBeFocused();
    await pressPad(1);
    await expect(page.locator('#add-dialog')).not.toBeVisible();
    await pressPad(3);
    await expect(page.locator('#search')).toBeFocused();
    await pressPad(5);
    await expect(page.locator('.category-card[data-category="technology"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.episode')).toHaveCount(0);
    await pressPad(1);
    await expect(page.locator('.episode')).toHaveCount(1);
    await page.locator('#add-top').click();
    await page.locator('#rss-url').fill(`${base}/feed-tech`);
    await page.locator('#submit-feed').click();
    await expect(page.locator('#library-count')).toHaveText('2');
    await page.locator('.category-card[data-category="science"]').click();
    await expect(page.locator('#featured-title')).toHaveText('Una partida, una historia');
    await expect(page.locator('.episode')).toHaveCount(1);
    await page.locator('.category-card[data-category="technology"]').click();
    await expect(page.locator('#featured-title')).toHaveText('Tecnología en partida');
    await expect(page.locator('.episode')).toHaveCount(1);
    await page.locator('.episode .queue-button').click();
    await expect(page.locator('#queue-count')).toHaveText('2');
    await app.close(); app = null;
    page = await launch();
    await expect(page.locator('#queue-count')).toHaveText('2');
    await page.locator('[data-view="queue"]').click();
    await expect(page.locator('.episode')).toHaveCount(2);
    await page.locator('#next').click();
    await expect(page.locator('#queue-count')).toHaveText('1');
    await expect(page.locator('#now-title')).toHaveText('Una partida, una historia');
    await expect.poll(() => page.locator('#audio').evaluate(audio => audio.duration)).toBe(90);
    await page.locator('#audio').evaluate(audio => { audio.currentTime = audio.duration - 0.25; });
    await expect(page.locator('#now-title')).toHaveText('Tecnología en partida');
    await expect(page.locator('#queue-count')).toHaveText('0');
    expect(await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('podcaststeam.v1'));
      return Object.values(stored.progress).some(progress => progress.completed);
    })).toBe(true);
    await expect.poll(() => page.locator('#audio').evaluate(audio => !audio.paused && audio.currentTime > 0.3)).toBe(true);
    await page.locator('#play').click();
    await page.locator('[data-view="all"]').click();
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const size of [{ width: 780, height: 600 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(size);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const player = await page.locator('.player').boundingBox();
      expect(player.y + player.height).toBeLessThanOrEqual(size.height - 39);
      await page.screenshot({ path: testInfo.outputPath(`steam-${size.width}.png`) });
    }
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(profile, { recursive: true, force: true });
  }
});
