const { XMLParser, XMLValidator } = require('fast-xml-parser');

function webUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function plain(value) {
  const text = typeof value === 'object' && value !== null ? value['#text'] : value;
  return String(text ?? '').replace(/<[^>]*>/g, '').trim();
}

function categories(value) {
  if (Array.isArray(value)) return value.flatMap(categories);
  if (typeof value === 'string') return [plain(value)];
  if (!value || typeof value !== 'object') return [];
  return [plain(value['@_text'] || value['#text']), ...categories(value['itunes:category'])].filter(Boolean);
}

function parseFeed(xml, source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new Error('El documento no es un RSS XML válido.');
  }
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(xml);
  const channel = parsed.rss?.channel;
  if (!channel) throw new Error('Este enlace no contiene un podcast RSS 2.0.');
  const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  const episodes = items.flatMap(item => {
    const enclosures = item.enclosure ? (Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure]) : [];
    const enclosure = enclosures.find(e => !e['@_type'] || String(e['@_type']).startsWith('audio/'));
    const audio = enclosure && webUrl(enclosure['@_url'], source);
    if (!audio) return [];
    return [{
      id: audio, audio, title: plain(item.title) || 'Episodio sin título',
      description: plain(item.description || item['itunes:summary']),
      date: plain(item.pubDate), duration: plain(item['itunes:duration'])
    }];
  });
  return {
    url: source, title: plain(channel.title) || 'Podcast sin título',
    author: plain(channel['itunes:author'] || channel.author),
    description: plain(channel.description),
    categories: [...new Set([...categories(channel['itunes:category']), ...categories(channel.category)])],
    artwork: webUrl(channel['itunes:image']?.['@_href'] || channel.image?.url, source), episodes
  };
}

async function loadFeed(input) {
  const url = webUrl(input);
  if (!url) throw new Error('Introduce una dirección RSS http o https válida.');
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`El servidor del podcast respondió con ${response.status}.`);
  const reader = response.body.getReader();
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024) throw new Error('El RSS supera el límite de 5 MB.');
      parts.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return parseFeed(Buffer.concat(parts).toString('utf8'), response.url);
}

module.exports = { parseFeed, webUrl, loadFeed };
