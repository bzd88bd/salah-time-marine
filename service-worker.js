const CACHE_NAME = "salah-time-marine-v1.7.2";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./adhan.umd.min.js",
    "./manifest.json"
];


/* ================================================
   INSTALL
================================================ */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())

    );

});


/* ================================================
   ACTIVATE
================================================ */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(names => {

                return Promise.all(

                    names
                        .filter(name =>
                            name.startsWith(
                                "salah-time-marine-"
                            ) &&
                            name !== CACHE_NAME
                        )
                        .map(name =>
                            caches.delete(name)
                        )

                );

            })
            .then(() => self.clients.claim())

    );

});


/* ================================================
   FETCH
================================================ */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }


    /* ============================================
       Navigation Request
       Safari offline refresh fix
    ============================================ */

    if (event.request.mode === "navigate") {

        event.respondWith(

            fetch(event.request)
                .catch(() => {

                    return caches.match("./index.html");

                })

        );

        return;

    }


    /* ============================================
       Other Files
    ============================================ */

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {

                    return cachedResponse;

                }

                return fetch(event.request);

            })

    );

});
