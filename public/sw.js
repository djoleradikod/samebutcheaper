/*
 * SameButCheaper service worker. Small on purpose:
 *  - pages always come from the network; when the network fails, /my-list is served from its last copy (the list
 *    itself lives in localStorage) and every other page gets /offline.html;
 *  - /_next/static files (content-hashed, so never stale) are kept after first use, so My list's scripts and the
 *    fonts work offline;
 *  - product photos (/_next/image, /products/) come from the network, with a copy of the last 80 for offline use;
 *  - nothing else is cached: no other page, no price, no country-dependent answer. /go/ and /out
 *    redirects, /admin, /api/, server actions (POST, or a Next-Action header) and router requests (RSC) are never
 *    touched, not even with an offline fallback.
 * Updating: change VERSION when this file's behaviour changes. Browsers fetch this file on each visit (served with
 * no-cache, registered with updateViaCache "none"); a new one takes over at once and deletes the old caches.
 * Kill switch: to remove it from every browser, replace this file with
 *   self.addEventListener("install", () => self.skipWaiting());
 *   self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).then(() => self.registration.unregister())));
 * The routing below is pure and tested in scripts/tests/service-worker.test.ts.
 */
(function (self) {
  "use strict";

  var VERSION = "v2";
  var SHELL_CACHE = "sbc-shell-" + VERSION;
  var STATIC_CACHE = "sbc-static-" + VERSION;
  var OFFLINE_URL = "/offline.html";
  var MY_LIST_URL = "/my-list";
  /** Kept at install. /my-list is fetched too, with the static files its page names (see cacheMyList). */
  var OFFLINE_DE_URL = "/offline-de.html";
  var SHELL = [OFFLINE_URL, OFFLINE_DE_URL, "/icons/icon-192.png"];
  var IMAGE_CACHE = "sbc-images-" + VERSION;
  var STATIC_MAX = 250;
  var IMAGE_MAX = 80;

  /** Paths the worker must never answer: each one itself and everything below it. */
  var NEVER = ["/go", "/out", "/admin", "/api", "/_next/data", "/sw.js", "/sw-register.js"];

  function isNever(path) {
    for (var i = 0; i < NEVER.length; i++) {
      if (path === NEVER[i] || path.indexOf(NEVER[i] + "/") === 0) return true;
    }
    return false;
  }

  /**
   * What to do with a request: "pass" (leave it to the browser), "page" (network, else /offline.html),
   * "my-list" (network and keep a copy, else the copy, else /offline.html), "static" (cache, else network and keep),
   * "shell" (from the install cache, else network), "image" (network and keep a copy, else the copy).
   * `req` needs method, url, mode and headers.get; `origin` is the site's origin.
   */
  function decide(req, origin) {
    if (req.method !== "GET") return "pass";
    var url;
    try {
      url = new URL(req.url);
    } catch {
      return "pass";
    }
    if (url.origin !== origin) return "pass";
    var path = url.pathname;
    if (isNever(path)) return "pass";
    var h = req.headers;
    if (h && (h.get("Next-Action") || h.get("RSC") || h.get("Next-Router-Prefetch") || h.get("Next-Router-State-Tree"))) return "pass";
    if (url.searchParams.has("_rsc")) return "pass";
    if (req.mode === "navigate") return path === MY_LIST_URL || path === MY_LIST_URL + "/" ? "my-list" : "page";
    if (path.indexOf("/_next/static/") === 0) return "static";
    // Product photos: the same everywhere, so a copy of the last few dozen lets My list show them offline.
    if (path === "/_next/image" || path.indexOf("/products/") === 0) return "image";
    if (SHELL.indexOf(path) !== -1) return "shell";
    return "pass";
  }

  /** Only a plain, complete, same-origin 200 is worth keeping. */
  function cacheable(res) {
    return !!res && res.status === 200 && res.type === "basic" && !res.redirected;
  }

  /** The /_next/static files a page's HTML names (scripts, styles, fonts). */
  function staticUrlsIn(html) {
    var out = [];
    var re = /\/_next\/static\/[A-Za-z0-9._~%\/-]+/g;
    var m;
    while ((m = re.exec(html))) if (out.indexOf(m[0]) === -1) out.push(m[0]);
    return out;
  }

  var api = { VERSION: VERSION, SHELL_CACHE: SHELL_CACHE, STATIC_CACHE: STATIC_CACHE, IMAGE_CACHE: IMAGE_CACHE, decide: decide, cacheable: cacheable, staticUrlsIn: staticUrlsIn, isNever: isNever };
  self.__sbcSw = api;
  if (typeof self.addEventListener !== "function" || typeof caches === "undefined") return;

  function trim(cache, max) {
    return cache.keys().then(function (keys) {
      var extra = keys.length - (max || STATIC_MAX);
      var jobs = [];
      for (var i = 0; i < extra; i++) jobs.push(cache.delete(keys[i]));
      return Promise.all(jobs);
    });
  }

  /** Keep /my-list's HTML and the static files it names, so it opens offline. */
  function cacheMyList(res) {
    return res.text().then(function (html) {
      // X-Sbc-Saved: when this copy was kept, so My list can say how old its prices are when it is served offline.
      var copy = new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "X-Sbc-Saved": new Date().toISOString() } });
      var urls = staticUrlsIn(html);
      return Promise.all([
        caches.open(SHELL_CACHE).then(function (c) {
          return c.put(MY_LIST_URL, copy);
        }),
        caches.open(STATIC_CACHE).then(function (c) {
          return Promise.all(
            urls.map(function (u) {
              return c.match(u).then(function (hit) {
                return hit || c.add(u).catch(function () {});
              });
            }),
          ).then(function () {
            return trim(c);
          });
        }),
      ]);
    });
  }

  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then(function (c) {
          return c.addAll(SHELL);
        })
        .then(function () {
          // Best effort: a failure here must not stop the worker installing.
          return fetch(MY_LIST_URL, { credentials: "same-origin" })
            .then(function (res) {
              return cacheable(res) ? cacheMyList(res) : null;
            })
            .catch(function () {});
        })
        .then(function () {
          return self.skipWaiting();
        }),
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys
              .filter(function (k) {
                return k.indexOf("sbc-") === 0 && k !== SHELL_CACHE && k !== STATIC_CACHE && k !== IMAGE_CACHE;
              })
              .map(function (k) {
                return caches.delete(k);
              }),
          );
        })
        .then(function () {
          return self.clients.claim();
        }),
    );
  });

  /** The German page for German URLs (/de/..., /datenschutz), else the English one. */
  function offline(req) {
    var path = req ? new URL(req.url).pathname : "/";
    var german = /^\/(de|datenschutz)(\/|$)/.test(path);
    return caches
      .match(german ? OFFLINE_DE_URL : OFFLINE_URL, { cacheName: SHELL_CACHE })
      .then(function (hit) {
        return hit || caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
      })
      .then(function (hit) {
        return hit || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      });
  }

  self.addEventListener("fetch", function (event) {
    var req = event.request;
    var kind = decide(req, self.location.origin);
    if (kind === "pass") return;

    if (kind === "page") {
      event.respondWith(
        fetch(req).catch(function () {
          return offline(req);
        }),
      );
      return;
    }

    if (kind === "my-list") {
      event.respondWith(
        fetch(req)
          .then(function (res) {
            if (cacheable(res)) event.waitUntil(cacheMyList(res.clone()).catch(function () {}));
            return res;
          })
          .catch(function () {
            return caches.match(MY_LIST_URL, { cacheName: SHELL_CACHE }).then(function (hit) {
              return hit || offline();
            });
          }),
      );
      return;
    }

    if (kind === "image") {
      // Network first, so a replaced photo shows at once; the copy is only for when there is no network.
      event.respondWith(
        fetch(req)
          .then(function (res) {
            if (cacheable(res)) {
              var copy = res.clone();
              event.waitUntil(
                caches.open(IMAGE_CACHE).then(function (cache) {
                  return cache.put(req, copy).then(function () {
                    return trim(cache, IMAGE_MAX);
                  });
                }),
              );
            }
            return res;
          })
          .catch(function (err) {
            return caches.match(req, { cacheName: IMAGE_CACHE }).then(function (hit) {
              if (hit) return hit;
              throw err;
            });
          }),
      );
      return;
    }

    if (kind === "static" || kind === "shell") {
      var name = kind === "static" ? STATIC_CACHE : SHELL_CACHE;
      event.respondWith(
        caches.open(name).then(function (cache) {
          return cache.match(req).then(function (hit) {
            if (hit) return hit;
            return fetch(req).then(function (res) {
              if (kind === "static" && cacheable(res)) {
                event.waitUntil(
                  cache.put(req, res.clone()).then(function () {
                    return trim(cache);
                  }),
                );
              }
              return res;
            });
          });
        }),
      );
    }
  });
})(self);
