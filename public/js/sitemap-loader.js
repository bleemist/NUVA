// sitemap-loader.js - Universal sitemap loader for NUVA
(function() {
  const SITEMAP_URL = 'https://nuva.me/sitemap.json';
  
  // Cache sitemap data
  let cachedSitemap = null;
  
  // Load sitemap data
  async function loadSitemap() {
    if (cachedSitemap) return cachedSitemap;
    
    try {
      const response = await fetch(SITEMAP_URL);
      cachedSitemap = await response.json();
      return cachedSitemap;
    } catch (error) {
      console.error('Failed to load NUVA sitemap:', error);
      return null;
    }
  }
  
  // Get all page URLs
  async function getAllUrls() {
    const sitemap = await loadSitemap();
    if (!sitemap) return [];
    return sitemap.pages.map(page => sitemap.domain + page.path);
  }
  
  // Get page info by path
  async function getPageInfo(path) {
    const sitemap = await loadSitemap();
    if (!sitemap) return null;
    return sitemap.pages.find(page => page.path === path);
  }
  
  // Export for use
  window.NUVASitemap = {
    load: loadSitemap,
    getUrls: getAllUrls,
    getPage: getPageInfo,
    domain: 'https://nuva.me'
  };
})();