/* Registers the service worker (public/sw.js) after the page has loaded. Secure origins only, as browsers require. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  var local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !local) return;
  function register() {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(function () {});
  }
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
})();
