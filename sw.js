// ============================================
// sw.js — SysCadeiras Mobile (PWA)
// ============================================
// Objetivo: depois de instalado uma vez, o app abre normalmente mesmo que
// o GitHub Pages (ou onde quer que esteja hospedado) esteja fora do ar, sem
// internet, ou o link tenha sido removido — a interface fica salva no
// próprio celular. Os DADOS (produção, estoque etc.) continuam precisando
// de internet para sincronizar com o Supabase, mas abrir o app não precisa.
//
// Estratégia:
//   - HTML (o próprio app): "network-first" — se tiver internet, sempre
//     busca a versão mais nova (assim atualizações chegam automaticamente);
//     se não tiver, usa a última versão salva em cache.
//   - Demais arquivos do app (manifest, ícones): "cache-first" — não mudam
//     com frequência, então serve do cache direto, mais rápido.
//   - Nunca intercepta chamadas para fora do próprio domínio (Supabase, CDN
//     de libs como @supabase/supabase-js e scrypt-js) — essas sempre vão
//     direto pra rede, como já funcionava antes.
// ============================================

const CACHE_NAME = 'syscadeiras-mobile-v1';

// Caminhos relativos ao local do próprio sw.js — funciona tanto em
// usuario.github.io/repo/ quanto em qualquer outro host ou subpasta.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(nomes =>
      Promise.all(nomes.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Só cuida de requisições do próprio app (mesma origem). Tudo que é
  // externo (Supabase, CDNs de bibliotecas) segue direto pra rede.
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  const ehHTML = req.mode === 'navigate' || req.destination === 'document';

  if (ehHTML) {
    // Network-first: tenta buscar a versão mais nova; se offline, usa cache.
    event.respondWith(
      fetch(req)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return resp;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first para o resto (manifest, ícones, css/js do próprio app se
  // algum dia forem separados do index.html).
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return resp;
      }).catch(() => cached);
    })
  );
});
