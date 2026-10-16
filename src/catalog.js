(function (root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.PodcastCatalog = catalog;
})(typeof window === 'object' ? window : globalThis, function () {
  const categories = [
    { id: 'technology', name: 'Tecnología', pattern: /technology|tecnologia|computing|informatica/ },
    { id: 'crime', name: 'True Crime', pattern: /true crime|crimen|criminologia|sucesos/ },
    { id: 'science', name: 'Ciencia', pattern: /science|ciencia|astronomy|astronomia|physics|fisica/ },
    { id: 'comedy', name: 'Comedia', pattern: /comedy|comedia|humor/ },
    { id: 'history', name: 'Historia', pattern: /history|historia/ }
  ];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function ids(feed) {
    const metadata = (Array.isArray(feed.categories) ? feed.categories : []).map(normalize).join(' ');
    return categories.filter(category => category.pattern.test(metadata)).map(category => category.id);
  }
  return { categories, ids, normalize };
});
