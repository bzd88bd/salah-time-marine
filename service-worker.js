const CACHE_NAME = "salah-time-marine-v1.7.1";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./adhan.umd.min.js",
    "./manifest.json"
];


/* ================================================
   Install
================================================ */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(APP_FILES);

            })
            .then(() => {

                return self.skipWaiting();

            })

    );

});


/* ================================================
   Activate
================================================ */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(name => {

                            return name.startsWith(
                                "salah-time-marine-"
                            ) &&
                            name !== CACHE_NAME;

                        })
                        .map(name => {

                            return caches.delete(name);

                        })

                );

            })
            .then(() => {

                return self.clients.claim();

            })

    );

});


/* ================================================
   Fetch
================================================ */

self.addEventListener("fetch", event => {

    /*
     * Only handle GET requests.
     */

    if (event.request.method !== "GET") {

        return;

    }


    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                /*
                 * Cached file available
                 */

                if (cachedResponse) {

                    return cachedResponse;

                }


                /*
                 * Not cached:
                 * try Internet
                 */

                return fetch(event.request);

            })
            .catch(() => {

                /*
                 * Internet unavailable and
                 * resource not cached.
                 */

                return new Response(
                    "Offline",
                    {
                        status: 503,
                        statusText: "Offline"
                    }
                );

            })

    );

});
