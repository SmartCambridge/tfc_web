importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js');


workbox.routing.registerRoute(
  'https://cdnjs.cloudflare.com/ajax/libs/onsen/2.10.6/js/onsenui.min.js',
  new workbox.strategies.NetworkFirst()
);

workbox.routing.registerRoute(
  'https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.3.0/sockjs.min.js',
  new workbox.strategies.NetworkFirst()
);

workbox.routing.registerRoute(
  'https://unpkg.com/leaflet@1.3.3/dist/leaflet.js',
  new workbox.strategies.NetworkFirst()
);

workbox.routing.registerRoute(
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
  new workbox.strategies.NetworkFirst()
);

workbox.routing.registerRoute(
  /(\.js|p\/|smartpanel\/pocket\/)$/,
  new workbox.strategies.NetworkFirst()
);

workbox.routing.registerRoute(
  // Cache CSS files.
  /\.css$/,
  // Use cache but update in the background.
  new workbox.strategies.StaleWhileRevalidate({
    // Use a custom cache name.
    cacheName: 'css-cache',
  })
);

workbox.routing.registerRoute(
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  new workbox.strategies.NetworkFirst({
    // Use a custom cache name.
    cacheName: 'css-cache',
  })
);

workbox.routing.registerRoute(
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  new workbox.strategies.NetworkFirst({
    // Use a custom cache name.
    cacheName: 'css-cache',
  })
);

workbox.routing.registerRoute(
  'https://cdnjs.cloudflare.com/ajax/libs/onsen/2.10.6/css/onsenui.css',
  new workbox.strategies.NetworkFirst({
    // Use a custom cache name.
    cacheName: 'css-cache',
  })
);

workbox.routing.registerRoute(
  'https://cdnjs.cloudflare.com/ajax/libs/onsen/2.10.6/css/onsen-css-components.min.css',
  new workbox.strategies.NetworkFirst({
    // Use a custom cache name.
    cacheName: 'css-cache',
  })
);

workbox.routing.registerRoute(
  // Cache image files.
  /\.(?:png|jpg|jpeg|svg|gif)$/,
  // Use the cache if it's available.
  new workbox.strategies.CacheFirst({
    // Use a custom cache name.
    cacheName: 'image-cache',
    plugins: [
      new workbox.expiration.Plugin({
        // Cache only 20 images.
        maxEntries: 20,
        // Cache for a maximum of a week.
        maxAgeSeconds: 7 * 24 * 60 * 60,
      })
    ],
  })
);