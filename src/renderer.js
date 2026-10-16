/* Feed text is rendered with textContent; remote HTML is never executed. */
const $ = selector => document.querySelector(selector);
const audio = $('#audio');
const catalog = window.PodcastCatalog;
const STORAGE_KEY = 'podcaststeam.v1';
let state;
try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* Recover invalid storage. */ }
if (!state || !Array.isArray(state.feeds) || typeof state.progress !== 'object' || !Array.isArray(state.favorites)) {
  state = { feeds: [], progress: {}, favorites: [], current: null, volume: 0.8, speed: 1 };
}
state.progress ||= {};
state.queue = Array.isArray(state.queue) ? state.queue.filter(entry => entry?.episode?.id && entry.feedUrl) : [];
let view = 'all', selectedFeed = null, selectedCategory = 'all', current = state.current, featured = null;
let noticeTimer, lastSave = 0, loading = false;
let restoreTime = current ? state.progress[current.episode.id]?.time || 0 : 0;

function notify(message) {
  $('#notice').textContent = message; $('#notice').hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 6000);
}
function persist() {
  state.current = current;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { notify('No se pudo guardar la biblioteca. Puede que el almacenamiento esté lleno.'); }
}
function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('icon'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#icon-${name}`); svg.append(use); return svg;
}
function cover(container, url) {
  container.replaceChildren();
  if (url) {
    const img = element('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => container.replaceChildren(icon('audio')));
    container.append(img);
  } else container.append(icon('audio'));
}
function entryFor(feed, episode) {
  return { feedUrl: feed.url, feedTitle: feed.title, author: feed.author, artwork: feed.artwork, episode };
}
function entries() {
  const query = catalog.normalize($('#search').value);
  const all = view === 'queue' ? state.queue : state.feeds.flatMap(feed => {
    if (selectedFeed && selectedFeed !== feed.url) return [];
    if (selectedCategory !== 'all' && !catalog.ids(feed).includes(selectedCategory)) return [];
    return feed.episodes.map(episode => entryFor(feed, episode));
  });
  return all.filter(entry => {
    const episode = entry.episode;
    if (view === 'favorites' && !state.favorites.includes(episode.id)) return false;
    if (view === 'progress' && !(state.progress[episode.id]?.time > 0 && !state.progress[episode.id]?.completed)) return false;
    return catalog.normalize(`${episode.title} ${entry.feedTitle} ${entry.author || ''}`).includes(query);
  });
}
function markViews() {
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
}
function setCategory(id, focus = false) {
  selectedCategory = id; selectedFeed = null; view = 'all'; render();
  if (focus) {
    const button = id === 'all' ? $('#reset-category') : $(`.category-card[data-category="${id}"]`);
    button.focus({ preventScroll: true }); button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
for (const category of catalog.categories) {
  const card = element('button', `category-card category-${category.id}`);
  card.dataset.category = category.id; card.append(element('span', '', category.name), element('small', 'category-count'));
  card.onclick = () => setCategory(category.id); $('#category-cards').append(card);
}
for (const id of ['science', 'history', 'comedy', 'crime', 'technology']) {
  const category = catalog.categories.find(item => item.id === id);
  const chip = element('button', 'category-chip', category.name); chip.dataset.category = id;
  chip.onclick = () => setCategory(id); $('#category-chips').append(chip);
}
function renderFeatured(list) {
  featured = list.find(entry => entry.episode.id === current?.episode.id) || list[0] || null;
  $('#featured-title').textContent = featured?.episode.title || (state.feeds.length ? 'No hay episodios en esta selección' : 'Tu próxima historia empieza aquí');
  $('#featured-author').textContent = featured ? (featured.author ? `Con ${featured.author}` : featured.feedTitle) : (state.feeds.length ? 'Prueba otra categoría o vuelve a todos tus podcasts.' : 'Añade tus podcasts favoritos mediante su enlace RSS.');
  $('#featured-play').disabled = !featured;
  $('#add-hero').hidden = Boolean(featured);
  const art = $('#featured-cover'); art.replaceChildren();
  const fallback = element('span', 'cover-wordmark', featured?.feedTitle || 'PODCAST\nSTEAM');
  art.append(fallback);
  if (featured?.artwork) {
    const img = element('img'); img.alt = `Portada de ${featured.feedTitle}`; img.referrerPolicy = 'no-referrer'; img.src = featured.artwork;
    img.onerror = () => img.remove(); art.append(img);
  }
}
function favorite(id) {
  state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
  persist(); render(); updatePlayer();
}
function toggleQueue(entry) {
  if (!entry) { notify('Selecciona un episodio para añadirlo a la cola.'); return; }
  const exists = state.queue.some(item => item.episode.id === entry.episode.id);
  state.queue = exists ? state.queue.filter(item => item.episode.id !== entry.episode.id) : [...state.queue, entry];
  persist(); render(); updatePlayer(); notify(exists ? 'Episodio eliminado de la cola.' : 'Episodio añadido a la cola.');
}
function render() {
  const focusKey = document.activeElement?.dataset.focusKey;
  markViews();
  $('#library-count').textContent = state.feeds.length; $('#queue-count').textContent = state.queue.length;
  const category = catalog.categories.find(item => item.id === selectedCategory);
  $('#view-title').firstChild.textContent = `${({ all: category?.name || 'Mi biblioteca', progress: 'Episodios empezados', favorites: 'Favoritos', queue: 'Cola de reproducción' })[view]} `;
  $('#podcast-count').textContent = view === 'queue' ? `${state.queue.length} episodios` : `${state.feeds.length} podcast${state.feeds.length === 1 ? '' : 's'}`;
  for (const button of document.querySelectorAll('[data-category]')) {
    button.setAttribute('aria-pressed', button.dataset.category === selectedCategory);
    const count = state.feeds.filter(feed => catalog.ids(feed).includes(button.dataset.category)).length;
    if (button.querySelector('.category-count')) button.querySelector('.category-count').textContent = `${count} podcast${count === 1 ? '' : 's'}`;
  }
  const tabs = $('#feed-tabs'); tabs.replaceChildren();
  if (view !== 'queue' && (state.feeds.length > 1 || selectedFeed)) {
    const all = element('button', `feed-tab ${selectedFeed === null ? 'selected' : ''}`, 'Todos los podcasts');
    all.dataset.focusKey = 'feed:all'; all.setAttribute('aria-pressed', selectedFeed === null);
    all.onclick = () => { selectedFeed = null; render(); updatePlayer(); }; tabs.append(all);
    for (const feed of state.feeds) {
      if (selectedCategory !== 'all' && !catalog.ids(feed).includes(selectedCategory)) continue;
      const tab = element('button', `feed-tab ${selectedFeed === feed.url ? 'selected' : ''}`, feed.title);
      tab.dataset.focusKey = `feed:${feed.url}`; tab.title = feed.title; tab.setAttribute('aria-pressed', selectedFeed === feed.url);
      tab.onclick = () => { selectedFeed = feed.url; render(); updatePlayer(); }; tabs.append(tab);
    }
    if (selectedFeed) {
      const remove = element('button', 'icon-button remove-feed'); remove.append(icon('close'));
      remove.title = 'Eliminar podcast'; remove.setAttribute('aria-label', 'Eliminar podcast'); remove.dataset.focusKey = 'feed:remove';
      remove.onclick = () => {
        if (!confirm('¿Eliminar este podcast de tu biblioteca y sus episodios guardados?')) return;
        const feed = state.feeds.find(item => item.url === selectedFeed);
        if (!feed) return;
        const ids = new Set(feed.episodes.map(episode => episode.id));
        if (current?.feedUrl === selectedFeed) { audio.pause(); audio.removeAttribute('src'); audio.load(); current = null; restoreTime = 0; }
        state.feeds = state.feeds.filter(item => item.url !== selectedFeed);
        state.queue = state.queue.filter(item => item.feedUrl !== selectedFeed);
        state.favorites = state.favorites.filter(id => !ids.has(id));
        for (const id of ids) delete state.progress[id];
        selectedFeed = null; persist(); render(); updatePlayer();
      }; tabs.append(remove);
    }
  }
  const list = entries(); renderFeatured(list);
  const container = $('#episodes'); container.replaceChildren();
  for (const entry of list) {
    const episode = entry.episode;
    const row = element('article', `episode ${current?.episode.id === episode.id ? 'playing' : ''}`); row.dataset.episodeId = episode.id;
    const art = element('div', 'episode-art'); cover(art, entry.artwork);
    const info = element('div', 'episode-info'); info.append(element('h3', '', episode.title), element('p', '', `${entry.feedTitle}${episode.description ? ` · ${episode.description}` : ''}`));
    const date = new Date(episode.date);
    const metadata = [Number.isFinite(date.getTime()) ? date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '', episode.duration,
      state.progress[episode.id]?.completed ? 'Escuchado' : state.progress[episode.id]?.time ? `Continuar en ${clock(state.progress[episode.id].time)}` : 'Sin escuchar'].filter(Boolean).join(' · ');
    info.append(element('small', '', metadata));
    const fav = element('button', 'icon-button favorite-button'); fav.append(icon('heart'));
    fav.dataset.focusKey = `favorite:${episode.id}`; fav.setAttribute('aria-label', `Favorito: ${episode.title}`); fav.setAttribute('aria-pressed', state.favorites.includes(episode.id)); fav.onclick = () => favorite(episode.id);
    const queue = element('button', 'icon-button queue-button'); queue.append(icon('plus'));
    const queued = state.queue.some(item => item.episode.id === episode.id);
    queue.dataset.focusKey = `queue:${episode.id}`; queue.setAttribute('aria-label', `${queued ? 'Quitar de la cola' : 'Añadir a la cola'}: ${episode.title}`); queue.setAttribute('aria-pressed', queued); queue.onclick = () => toggleQueue(entry);
    const play = element('button', 'episode-play'); play.append(icon('play')); play.dataset.focusKey = `play:${episode.id}`; play.setAttribute('aria-label', `Reproducir ${episode.title}`);
    play.onclick = () => selectEntry(entry, view === 'queue'); row.append(art, info, fav, queue, play); container.append(row);
  }
  $('#empty').hidden = state.feeds.length > 0;
  if (state.feeds.length && !list.length) {
    const message = view === 'queue' ? 'Tu cola está vacía. Añade un episodio con + o con X en el mando.' : view === 'favorites' ? 'Marca un episodio con el corazón para guardarlo aquí.' : view === 'progress' ? 'Los episodios que empieces aparecerán aquí.' : selectedCategory !== 'all' ? 'No hay podcasts de esta categoría en tu selección. Actualiza tus RSS para leer sus categorías o pulsa Ver todos.' : 'No hay episodios que coincidan con la búsqueda.';
    container.append(element('p', 'empty', message));
  }
  if (focusKey) document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  updateFeaturedButton();
}
function saveProgress(force = false) {
  if (!current || restoreTime > 0 || !Number.isFinite(audio.currentTime)) return;
  state.progress[current.episode.id] = { time: audio.currentTime, completed: audio.ended, updated: Date.now() };
  if (force || Date.now() - lastSave > 4000) { persist(); lastSave = Date.now(); }
}
async function playAudio() {
  if (!current) return;
  try { await audio.play(); }
  catch (error) { if (error.name !== 'AbortError') notify('No se pudo reproducir este audio. Comprueba la conexión o prueba otro episodio.'); }
}
function selectEntry(entry, fromQueue = false) {
  if (current?.episode.id === entry.episode.id && !fromQueue) { toggle(); return; }
  saveProgress(true); audio.pause(); current = { ...entry };
  state.queue = state.queue.filter(item => item.episode.id !== entry.episode.id);
  restoreTime = fromQueue || state.progress[entry.episode.id]?.completed ? 0 : state.progress[entry.episode.id]?.time || 0;
  audio.src = entry.episode.audio; audio.load(); persist(); render(); updatePlayer(); playAudio();
}
function playNext() {
  const next = state.queue[0];
  if (next) selectEntry(next, true);
}
function toggle() { if (current) { if (audio.paused) playAudio(); else audio.pause(); } }
function skip(seconds) {
  if (!current || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds)); saveProgress(true);
}
function updateFeaturedButton() {
  const playing = featured && featured.episode.id === current?.episode.id && !audio.paused;
  $('#featured-play .icon').replaceWith(icon(playing ? 'pause' : 'play'));
  $('#featured-play span').textContent = playing ? 'Pausar' : 'Reproducir';
}
function updatePlayer() {
  const ready = Boolean(current);
  for (const selector of ['#play', '#back', '#forward', '#previous', '#dialog-toggle', '#player-favorite']) $(selector).disabled = !ready;
  $('#next').disabled = !state.queue.length;
  $('#seek').disabled = !ready || !Number.isFinite(audio.duration);
  $('#now-title').textContent = current?.episode.title || 'Una historia para tu próxima partida';
  $('#now-podcast').textContent = current?.feedTitle || 'PodcastSteam';
  $('#now-author').textContent = current?.author || (current ? 'Podcast de tu biblioteca' : 'Elige un episodio');
  $('#dialog-track').textContent = current?.episode.title || 'Elige un episodio para empezar.';
  $('#playback-status').textContent = !current ? 'LISTO PARA ESCUCHAR' : audio.paused ? 'EN PAUSA' : 'REPRODUCIENDO';
  $('#player-heading').textContent = current ? 'Continuar escuchando' : 'Tu reproductor';
  $('#play').replaceChildren(icon(audio.paused ? 'play' : 'pause'));
  $('#play').setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
  $('#dialog-toggle').textContent = audio.paused ? 'Reproducir' : 'Pausar';
  $('#player-favorite').setAttribute('aria-pressed', Boolean(current && state.favorites.includes(current.episode.id)));
  cover($('#mini-cover'), current?.artwork); updateFeaturedButton();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = current ? new MediaMetadata({ title: current.episode.title, artist: current.feedTitle, album: 'PodcastSteam' }) : null;
    navigator.mediaSession.playbackState = !current ? 'none' : audio.paused ? 'paused' : 'playing';
  }
}
function timeline() {
  $('#elapsed').textContent = clock(audio.currentTime); $('#duration').textContent = clock(audio.duration);
  $('#seek').value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
}
audio.addEventListener('loadedmetadata', () => {
  audio.playbackRate = state.speed || 1;
  if (restoreTime && Number.isFinite(audio.duration)) audio.currentTime = Math.min(restoreTime, Math.max(0, audio.duration - 1));
  restoreTime = 0; updatePlayer(); timeline();
});
audio.addEventListener('timeupdate', () => { timeline(); saveProgress(); });
audio.addEventListener('emptied', timeline);
audio.addEventListener('play', updatePlayer);
audio.addEventListener('pause', () => { saveProgress(true); updatePlayer(); });
audio.addEventListener('ended', () => { saveProgress(true); render(); updatePlayer(); if (state.queue.length) playNext(); });
audio.addEventListener('error', () => { if (current) notify('El audio no está disponible o su formato no es compatible. Prueba otro episodio o actualiza el podcast.'); });
$('#play').onclick = toggle; $('#dialog-toggle').onclick = toggle;
$('#back').onclick = () => skip(-15); $('#previous').onclick = () => skip(-15); $('#forward').onclick = () => skip(30); $('#next').onclick = playNext;
$('#featured-play').onclick = () => { if (featured) selectEntry(featured, view === 'queue'); };
$('#seek').addEventListener('input', event => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(event.target.value) / 100 * audio.duration; saveProgress(true); } });
$('#volume').value = state.volume ?? 0.8; audio.volume = Number($('#volume').value);
$('#volume').addEventListener('input', event => { audio.volume = Number(event.target.value); state.volume = audio.volume; persist(); });
$('#speed').value = String(state.speed || 1); audio.defaultPlaybackRate = audio.playbackRate = Number($('#speed').value);
$('#speed').onchange = event => { audio.defaultPlaybackRate = audio.playbackRate = Number(event.target.value); state.speed = audio.playbackRate; persist(); };
$('#player-favorite').onclick = () => { if (current) favorite(current.episode.id); };
$('#search').oninput = () => { selectedFeed = null; render(); };
$('#reset-category').onclick = () => { $('#search').value = ''; setCategory('all'); };
document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => { view = button.dataset.view; selectedFeed = null; selectedCategory = 'all'; render(); }; });
function openDialog() { $('#form-error').textContent = ''; $('#add-dialog').showModal(); $('#rss-url').focus(); }
for (const selector of ['#add-top', '#add-hero', '#add-empty']) $(selector).onclick = openDialog;
$('#close-dialog').onclick = () => $('#add-dialog').close();
$('#player-settings').onclick = () => {
  $('#player-dialog').showModal();
  (current ? $('#dialog-toggle') : $('#volume')).focus();
};
$('#close-player-dialog').onclick = () => $('#player-dialog').close();
$('#add-dialog').addEventListener('cancel', event => { if (loading) event.preventDefault(); });
$('#add-form').onsubmit = async event => {
  event.preventDefault(); if (loading) return;
  if (!window.podcast) { $('#form-error').textContent = 'Abre la aplicación de escritorio para añadir podcasts.'; return; }
  loading = true; $('#submit-feed').disabled = true; $('#close-dialog').disabled = true;
  $('#submit-feed').textContent = 'Cargando podcast…'; $('#form-error').textContent = '';
  try {
    const feed = await window.podcast.load($('#rss-url').value.trim());
    if (!feed.episodes.length) throw new Error('Este RSS no contiene episodios con audio compatible.');
    const existing = state.feeds.findIndex(item => item.url === feed.url);
    if (existing >= 0) state.feeds[existing] = feed; else state.feeds.push(feed);
    selectedFeed = feed.url; selectedCategory = 'all'; view = 'all'; persist(); render(); $('#add-dialog').close(); $('#rss-url').value = '';
    notify(`${feed.title}: ${feed.episodes.length} episodios disponibles.`);
  } catch (error) { $('#form-error').textContent = error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''); }
  finally { loading = false; $('#submit-feed').disabled = false; $('#close-dialog').disabled = false; $('#submit-feed').textContent = 'Añadir a mi biblioteca →'; }
};
$('#refresh').onclick = async () => {
  if (!state.feeds.length) { openDialog(); return; }
  if (!window.podcast) return;
  $('#refresh').disabled = true; const failures = [];
  for (const feed of [...state.feeds]) {
    try {
      const updated = await window.podcast.load(feed.url);
      const index = state.feeds.findIndex(item => item.url === feed.url);
      if (index >= 0) state.feeds[index] = updated;
      if (selectedFeed === feed.url) selectedFeed = updated.url;
    } catch { failures.push(feed.title); }
  }
  persist(); render(); $('#refresh').disabled = false;
  notify(failures.length ? `No se pudo actualizar: ${failures.join(', ')}. Conservamos los episodios guardados.` : 'Biblioteca actualizada.');
};
window.addEventListener('beforeunload', () => saveProgress(true));
document.addEventListener('keydown', event => {
  if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName) || $('dialog[open]')) return;
  if (event.code === 'Space') { event.preventDefault(); toggle(); }
  if (event.code === 'ArrowLeft') { event.preventDefault(); skip(-15); }
  if (event.code === 'ArrowRight') { event.preventDefault(); skip(30); }
});
window.podcast?.onToggle(toggle);
if ('mediaSession' in navigator) {
  for (const [action, handler] of Object.entries({ play: playAudio, pause: () => audio.pause(), seekbackward: () => skip(-15), seekforward: () => skip(30), nexttrack: playNext, seekto: event => { if (Number.isFinite(event.seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, event.seekTime)); } })) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Platform-dependent. */ }
  }
}
const previousButtons = new Map(); let controllerConnected = false;
document.addEventListener('pointerdown', () => document.body.classList.remove('using-gamepad'));
function pollGamepads() {
  const pads = [...(navigator.getGamepads?.() || [])].filter(pad => pad?.mapping === 'standard');
  if (Boolean(pads.length) !== controllerConnected) {
    controllerConnected = Boolean(pads.length); $('#input-mode').textContent = controllerConnected ? 'Mando conectado' : 'Teclado y ratón';
    if (!controllerConnected) document.body.classList.remove('using-gamepad');
  }
  for (const pad of pads) {
    const previous = previousButtons.get(pad.index) || [];
    const pressed = index => pad.buttons[index]?.pressed && !previous[index];
    const buttons = pad.buttons.map(button => button.pressed); previousButtons.set(pad.index, buttons);
    if (document.hidden || !document.hasFocus()) continue;
    if (buttons.some((value, index) => value && !previous[index])) document.body.classList.add('using-gamepad');
    const dialog = $('dialog[open]');
    if (pressed(1)) {
      if (dialog) { if (dialog.id !== 'add-dialog' || !loading) dialog.close(); }
      else if ($('#search').value) { $('#search').value = ''; render(); }
      else if (selectedCategory !== 'all') setCategory('all');
      else if (selectedFeed) { selectedFeed = null; render(); }
      else { $('[data-view="all"]').click(); $('[data-view="all"]').focus(); }
    }
    if (pressed(0)) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.matches(':disabled') && (!dialog || dialog.contains(active))) active.click();
    }
    if (!dialog) {
      if (pressed(3)) $('#search').focus();
      if (pressed(8)) $('#player-settings').click();
      if (pressed(2)) {
        const id = document.activeElement?.closest('.episode')?.dataset.episodeId;
        toggleQueue(entries().find(entry => entry.episode.id === id) || featured);
      }
      if (pressed(4) || pressed(5)) {
        const ids = ['all', ...catalog.categories.map(category => category.id)];
        const index = ids.indexOf(selectedCategory);
        setCategory(ids[(index + (pressed(4) ? -1 : 1) + ids.length) % ids.length], true);
      }
    }
    const direction = [12, 13, 14, 15].find(pressed);
    if (direction !== undefined) {
      const root = $('dialog[open]') || document;
      const adjusted = direction >= 14 && window.controllerNavigation.adjust(document.activeElement, direction === 14 ? -1 : 1);
      if (!adjusted) window.controllerNavigation.move({ 12: 'up', 13: 'down', 14: 'left', 15: 'right' }[direction], root);
    }
  }
  requestAnimationFrame(pollGamepads);
}
window.addEventListener('gamepaddisconnected', event => previousButtons.delete(event.gamepad.index));
requestAnimationFrame(pollGamepads);
if (current) { audio.src = current.episode.audio; audio.load(); }
render(); updatePlayer();
