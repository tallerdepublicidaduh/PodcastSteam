/* Remote feed text is rendered only through textContent, never HTML. */
const $ = selector => document.querySelector(selector);
const audio = $('#audio');
const STORAGE_KEY = 'podcaststeam.v1';
let state;
try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* Recover corrupt local storage. */ }
if (!state || !Array.isArray(state.feeds) || typeof state.progress !== 'object' || !Array.isArray(state.favorites)) {
  state = { feeds: [], progress: {}, favorites: [], current: null, volume: 0.8, speed: 1 };
}
state.progress ||= {};
let view = 'all', selectedFeed = null, current = state.current, noticeTimer, lastSave = 0, loading = false;
let restoreTime = current ? state.progress[current.episode.id]?.time || 0 : 0;

function notify(message) {
  $('#notice').textContent = message;
  $('#notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 6500);
}
function persist() {
  state.current = current;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { notify('No se pudo guardar la biblioteca. Puede que el almacenamiento esté lleno.'); }
}
function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds), minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
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
  use.setAttribute('href', `#icon-${name}`); svg.append(use);
  return svg;
}
function cover(container, url) {
  container.replaceChildren();
  if (url) {
    const img = element('img');
    img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => { container.replaceChildren(icon('audio')); });
    container.append(img);
  } else container.append(icon('audio'));
}
function favorite(id) {
  if (state.favorites.includes(id)) state.favorites = state.favorites.filter(item => item !== id);
  else state.favorites.push(id);
  persist(); render(); updatePlayer();
}
function render() {
  const focusKey = document.activeElement?.dataset.focusKey;
  document.body.classList.toggle('has-library', state.feeds.length > 0);
  $('#library-count').textContent = state.feeds.length;
  $('#podcast-count').textContent = `${state.feeds.length} podcast${state.feeds.length === 1 ? '' : 's'}`;
  $('#view-title').firstChild.textContent = { all: 'Mi biblioteca ', progress: 'Seguir escuchando ', favorites: 'Favoritos ' }[view];
  $('#add-hero').textContent = state.feeds.length ? '＋ Descubrir otro podcast' : '＋ Añadir mi primer podcast';
  const tabs = $('#feed-tabs'); tabs.replaceChildren();
  if (state.feeds.length) {
    const all = element('button', `feed-tab all-feeds ${selectedFeed === null ? 'selected' : ''}`);
    const allCover = element('span', 'feed-cover'); allCover.append(icon('library'));
    all.append(allCover, element('strong', '', 'Todos'), element('small', '', `${state.feeds.length} podcast${state.feeds.length === 1 ? '' : 's'}`));
    all.dataset.focusKey = 'feed:all'; all.setAttribute('aria-pressed', selectedFeed === null);
    all.onclick = () => { selectedFeed = null; render(); }; tabs.append(all);
    for (const feed of state.feeds) {
      const tab = element('button', `feed-tab ${selectedFeed === feed.url ? 'selected' : ''}`);
      const art = element('span', 'feed-cover'); cover(art, feed.artwork);
      tab.append(art, element('strong', '', feed.title), element('small', '', `${feed.episodes.length} episodio${feed.episodes.length === 1 ? '' : 's'}`));
      tab.dataset.focusKey = `feed:${feed.url}`; tab.title = feed.title;
      tab.setAttribute('aria-pressed', selectedFeed === feed.url);
      tab.onclick = () => { selectedFeed = feed.url; render(); }; tabs.append(tab);
    }
    if (selectedFeed) {
      const remove = element('button', 'icon-button remove-feed'); remove.append(icon('close'));
      remove.title = 'Eliminar podcast'; remove.setAttribute('aria-label', 'Eliminar podcast');
      remove.dataset.focusKey = 'feed:remove';
      remove.onclick = () => {
        if (!confirm('¿Eliminar este podcast de tu biblioteca y sus episodios guardados?')) return;
        const feed = state.feeds.find(item => item.url === selectedFeed);
        const ids = new Set(feed.episodes.map(episode => episode.id));
        if (current?.feedUrl === selectedFeed) { audio.pause(); audio.removeAttribute('src'); audio.load(); current = null; restoreTime = 0; }
        state.feeds = state.feeds.filter(item => item.url !== selectedFeed);
        state.favorites = state.favorites.filter(id => !ids.has(id));
        for (const id of ids) delete state.progress[id];
        selectedFeed = null; persist(); render(); updatePlayer();
      }; tabs.append(remove);
    }
  }
  const list = $('#episodes'); list.replaceChildren();
  const query = $('#search').value.toLocaleLowerCase();
  let count = 0;
  for (const feed of state.feeds) {
    if (selectedFeed && selectedFeed !== feed.url) continue;
    for (const episode of feed.episodes) {
      if (view === 'favorites' && !state.favorites.includes(episode.id)) continue;
      if (view === 'progress' && !(state.progress[episode.id]?.time > 0 && !state.progress[episode.id]?.completed)) continue;
      if (!`${episode.title} ${feed.title}`.toLocaleLowerCase().includes(query)) continue;
      count++;
      const row = element('article', `episode ${current?.episode.id === episode.id ? 'playing' : ''}`);
      const art = element('div', 'episode-art'); cover(art, feed.artwork);
      const info = element('div', 'episode-info'); info.append(element('h3', '', episode.title));
      info.append(element('p', '', `${feed.title}${episode.description ? ` · ${episode.description}` : ''}`));
      const date = new Date(episode.date);
      const metadata = [Number.isFinite(date.getTime()) ? date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '', episode.duration,
        state.progress[episode.id]?.completed ? 'Escuchado' : state.progress[episode.id]?.time ? `Continuar en ${clock(state.progress[episode.id].time)}` : 'Sin escuchar'].filter(Boolean).join(' · ');
      info.append(element('small', '', metadata));
      const fav = element('button', 'icon-button'); fav.append(icon('heart'));
      fav.dataset.focusKey = `favorite:${episode.id}`;
      fav.setAttribute('aria-label', `Favorito: ${episode.title}`); fav.setAttribute('aria-pressed', state.favorites.includes(episode.id));
      fav.onclick = () => favorite(episode.id);
      const play = element('button', 'episode-play'); play.append(icon('play'));
      play.dataset.focusKey = `play:${episode.id}`; play.setAttribute('aria-label', `Reproducir ${episode.title}`);
      play.onclick = () => selectEpisode(feed, episode);
      row.append(art, info, fav, play); list.append(row);
    }
  }
  $('#empty').hidden = state.feeds.length > 0;
  if (state.feeds.length && !count) list.append(element('p', 'empty', view === 'progress' ? 'Los episodios que empieces aparecerán aquí.' : view === 'favorites' ? 'Marca un episodio con el corazón para guardarlo aquí.' : 'No hay episodios de audio que coincidan.'));
  if (focusKey) document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

function saveProgress(force = false) {
  if (!current || restoreTime > 0 || !Number.isFinite(audio.currentTime)) return;
  state.progress[current.episode.id] = { time: audio.currentTime, completed: audio.ended, updated: Date.now() };
  if (force || Date.now() - lastSave > 4000) { persist(); lastSave = Date.now(); }
}
async function playAudio() {
  try { await audio.play(); }
  catch (error) { if (error.name !== 'AbortError') notify('No se pudo reproducir este audio. Comprueba la conexión o prueba otro episodio.'); }
}
function selectEpisode(feed, episode) {
  if (current?.episode.id === episode.id) { toggle(); return; }
  saveProgress(true); audio.pause();
  current = { feedUrl: feed.url, feedTitle: feed.title, artwork: feed.artwork, episode };
  restoreTime = state.progress[episode.id]?.completed ? 0 : state.progress[episode.id]?.time || 0;
  audio.src = episode.audio; audio.load();
  persist(); render(); updatePlayer(); playAudio();
}
function toggle() {
  if (!current) return;
  if (audio.paused) playAudio(); else audio.pause();
}
function skip(seconds) {
  if (!current || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  saveProgress(true);
}
function updatePlayer() {
  const ready = Boolean(current);
  for (const selector of ['#play', '#back', '#forward', '#player-favorite']) $(selector).disabled = !ready;
  $('#seek').disabled = !ready || !Number.isFinite(audio.duration);
  $('#now-title').textContent = current?.episode.title || 'Elige tu próxima historia';
  $('#now-podcast').textContent = current?.feedTitle || 'Selecciona un episodio de tu biblioteca';
  $('#playback-status').textContent = !current ? 'LISTO PARA ESCUCHAR' : audio.paused ? 'EN PAUSA' : 'REPRODUCIENDO';
  $('#play').replaceChildren(icon(audio.paused ? 'play' : 'pause'));
  $('#play').setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
  $('#player-favorite').setAttribute('aria-pressed', Boolean(current && state.favorites.includes(current.episode.id)));
  cover($('#mini-cover'), current?.artwork);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = current ? new MediaMetadata({ title: current.episode.title, artist: current.feedTitle, album: 'PodcastSteam' }) : null;
    navigator.mediaSession.playbackState = !current ? 'none' : audio.paused ? 'paused' : 'playing';
  }
}
function timeline() {
  $('#elapsed').textContent = clock(audio.currentTime);
  $('#duration').textContent = clock(audio.duration);
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
audio.addEventListener('ended', () => { saveProgress(true); render(); updatePlayer(); });
audio.addEventListener('error', () => { if (current) notify('El audio no está disponible o su formato no es compatible. Prueba otro episodio o actualiza el podcast.'); });
$('#play').onclick = toggle;
$('#back').onclick = () => skip(-15);
$('#forward').onclick = () => skip(30);
$('#seek').addEventListener('input', event => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(event.target.value) / 100 * audio.duration; saveProgress(true); } });
$('#volume').value = state.volume ?? 0.8; audio.volume = Number($('#volume').value);
$('#volume').addEventListener('input', event => { audio.volume = Number(event.target.value); state.volume = audio.volume; persist(); });
$('#speed').value = String(state.speed || 1); audio.defaultPlaybackRate = audio.playbackRate = Number($('#speed').value);
$('#speed').onchange = event => { audio.defaultPlaybackRate = audio.playbackRate = Number(event.target.value); state.speed = audio.playbackRate; persist(); };
$('#player-favorite').onclick = () => { if (current) favorite(current.episode.id); };
$('#search').oninput = render;
document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => {
  view = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(item => {
    item.classList.toggle('active', item === button);
    if (item === button) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  render();
}; });
function openDialog() { $('#form-error').textContent = ''; $('#add-dialog').showModal(); $('#rss-url').focus(); }
for (const selector of ['#add-top', '#add-hero', '#add-empty']) $(selector).onclick = openDialog;
$('#close-dialog').onclick = () => $('#add-dialog').close();
$('#add-dialog').addEventListener('cancel', event => { if (loading) event.preventDefault(); });
$('#add-form').onsubmit = async event => {
  event.preventDefault(); if (loading) return;
  if (!window.podcast) { $('#form-error').textContent = 'Abre la aplicación de escritorio con npm start para añadir podcasts.'; return; }
  loading = true; $('#submit-feed').disabled = true; $('#close-dialog').disabled = true;
  $('#submit-feed').textContent = 'Cargando podcast…'; $('#form-error').textContent = '';
  try {
    const feed = await window.podcast.load($('#rss-url').value.trim());
    if (!feed.episodes.length) throw new Error('Este RSS no contiene episodios con audio compatible.');
    const existing = state.feeds.findIndex(item => item.url === feed.url);
    if (existing >= 0) state.feeds[existing] = feed; else state.feeds.push(feed);
    selectedFeed = feed.url; persist(); render(); $('#add-dialog').close(); $('#rss-url').value = '';
    notify(`${feed.title}: ${feed.episodes.length} episodios disponibles.`);
  } catch (error) { $('#form-error').textContent = error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''); }
  finally { loading = false; $('#submit-feed').disabled = false; $('#close-dialog').disabled = false; $('#submit-feed').textContent = 'Añadir a mi biblioteca →'; }
};
$('#refresh').onclick = async () => {
  if (!state.feeds.length) { openDialog(); return; }
  if (!window.podcast) return;
  $('#refresh').disabled = true;
  const failures = [];
  for (const feed of [...state.feeds]) {
    try {
      const updated = await window.podcast.load(feed.url);
      const index = state.feeds.findIndex(item => item.url === feed.url);
      if (index >= 0) state.feeds[index] = updated;
      if (selectedFeed === feed.url) selectedFeed = updated.url;
    }
    catch { failures.push(feed.title); }
  }
  persist(); render(); $('#refresh').disabled = false;
  notify(failures.length ? `No se pudo actualizar: ${failures.join(', ')}. Conservamos los episodios guardados.` : 'Biblioteca actualizada.');
};
window.addEventListener('beforeunload', () => saveProgress(true));
document.addEventListener('keydown', event => {
  if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName) || $('#add-dialog').open) return;
  if (event.code === 'Space') { event.preventDefault(); toggle(); }
  if (event.code === 'ArrowLeft') { event.preventDefault(); skip(-15); }
  if (event.code === 'ArrowRight') { event.preventDefault(); skip(30); }
});
window.podcast?.onToggle(toggle);
if ('mediaSession' in navigator) {
  for (const [action, handler] of Object.entries({ play: playAudio, pause: () => audio.pause(), seekbackward: () => skip(-15), seekforward: () => skip(30), seekto: event => { if (Number.isFinite(event.seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, event.seekTime)); } })) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* OS-dependent media actions. */ }
  }
}
// Controls affect the app only while its window has focus, leaving game input alone.
const previousButtons = new Map();
let controllerConnected = false;
document.addEventListener('pointerdown', () => document.body.classList.remove('using-gamepad'));
function pollGamepads() {
  const pads = [...(navigator.getGamepads?.() || [])].filter(pad => pad?.mapping === 'standard');
  if (Boolean(pads.length) !== controllerConnected) {
    controllerConnected = Boolean(pads.length);
    $('#input-mode').textContent = controllerConnected ? 'Mando conectado' : 'Teclado y ratón';
    if (!controllerConnected) document.body.classList.remove('using-gamepad');
  }
  for (const pad of pads) {
    const previous = previousButtons.get(pad.index) || [];
    const pressed = index => pad.buttons[index]?.pressed && !previous[index];
    const buttons = pad.buttons.map(button => button.pressed);
    previousButtons.set(pad.index, buttons);
    if (document.hidden || !document.hasFocus()) continue;
    if (buttons.some((value, index) => value && !previous[index])) document.body.classList.add('using-gamepad');
    if (pressed(2)) toggle();
    if (pressed(4)) skip(-15);
    if (pressed(5)) skip(30);
    if (pressed(1)) {
      if ($('#add-dialog').open) { if (!loading) $('#add-dialog').close(); }
      else if (selectedFeed) { selectedFeed = null; render(); }
      else if (view !== 'all') $('[data-view="all"]').click();
      else $('[data-view="all"]').focus();
    }
    if (pressed(0)) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.matches(':disabled') && (!$('#add-dialog').open || $('#add-dialog').contains(active))) active.click();
    }
    const directionIndex = [12, 13, 14, 15].find(pressed);
    if (directionIndex !== undefined) {
      const root = $('#add-dialog').open ? $('#add-dialog') : document;
      const adjusted = directionIndex >= 14 && window.controllerNavigation.adjust(document.activeElement, directionIndex === 14 ? -1 : 1);
      if (!adjusted) window.controllerNavigation.move({12: 'up', 13: 'down', 14: 'left', 15: 'right'}[directionIndex], root);
    }
  }
  requestAnimationFrame(pollGamepads);
}
window.addEventListener('gamepaddisconnected', event => previousButtons.delete(event.gamepad.index));
requestAnimationFrame(pollGamepads);
if (current) { audio.src = current.episode.audio; audio.load(); }
render(); updatePlayer();
