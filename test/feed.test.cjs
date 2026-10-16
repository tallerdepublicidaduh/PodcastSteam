const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { parseFeed, webUrl, loadFeed } = require('../src/feed.cjs');

const fixture = `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Historias jugando</title><itunes:author>Estudio</itunes:author><description>Un podcast</description><itunes:image href="https://example.com/art.jpg"/><item><title>Primera partida</title><description><![CDATA[<p>Una historia <b>nueva</b></p>]]></description><guid>episode-1</guid><pubDate>Tue, 01 Sep 2026 12:00:00 GMT</pubDate><itunes:duration>32:10</itunes:duration><enclosure url="https://example.com/one.mp3" type="audio/mpeg"/></item><item><title>Archivo inseguro</title><enclosure url="file:///etc/passwd" type="audio/mpeg"/></item><item><title>Vídeo</title><enclosure url="https://example.com/movie.mp4" type="video/mp4"/></item></channel></rss>`;

test('normaliza RSS, metadatos de iTunes y audio; elimina HTML de descripciones', () => {
  const feed = parseFeed(fixture, 'https://example.com/rss');
  assert.equal(feed.title, 'Historias jugando');
  assert.equal(feed.author, 'Estudio');
  assert.equal(feed.artwork, 'https://example.com/art.jpg');
  assert.equal(feed.episodes.length, 1);
  assert.equal(feed.episodes[0].description, 'Una historia nueva');
  assert.equal(feed.episodes[0].duration, '32:10');
});
test('admite un solo episodio y resuelve URL relativas', () => {
  const feed = parseFeed('<rss><channel><title>Uno</title><item><title>A</title><enclosure url="/a.mp3"/></item></channel></rss>', 'https://example.com/rss');
  assert.equal(feed.episodes[0].audio, 'https://example.com/a.mp3');
});
test('rechaza documentos malformados, entidades y formatos ajenos a RSS', () => {
  for (const input of ['<rss>', '<html><body>hola</body></html>', '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>']) {
    assert.throws(() => parseFeed(input, 'https://example.com'));
  }
});
test('rechaza protocolos ejecutables y credenciales incrustadas', () => {
  for (const url of [undefined, '', '  ', 'javascript:alert(1)', 'file:///tmp/a', 'https://user:pass@example.com/feed']) assert.equal(webUrl(url, 'https://example.com'), null);
  assert.equal(webUrl('https://example.com/rss'), 'https://example.com/rss');
});
test('conserva caracteres XML y no inventa imágenes ni enclosures ausentes', () => {
  const feed = parseFeed('<rss><channel><title>A &amp; B</title><item><title>Sin audio</title><enclosure type="audio/mpeg"/></item></channel></rss>', 'https://example.com/rss');
  assert.equal(feed.title, 'A & B');
  assert.equal(feed.artwork, null);
  assert.equal(feed.episodes.length, 0);
});
test('descarga RSS real por HTTP, sigue redirecciones y propaga errores HTTP', async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/feed' }); res.end(); }
    else if (req.url === '/feed') { res.setHeader('Content-Type', 'application/rss+xml'); res.end(fixture); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const feed = await loadFeed(`${base}/redirect`);
  assert.equal(feed.url, `${base}/feed`);
  assert.equal(feed.episodes.length, 1);
  await assert.rejects(loadFeed(`${base}/missing`), /404/);
});
test('limita el tamaño de un RSS descargado', async t => {
  const server = http.createServer((req, res) => res.end('x'.repeat(5 * 1024 * 1024 + 1)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(loadFeed(`http://127.0.0.1:${server.address().port}`), /5 MB/);
});
