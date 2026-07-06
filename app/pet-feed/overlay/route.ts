import { getPetFeedConfig } from "@/lib/petfeed/config";

/**
 * GET /pet-feed/overlay — the OBS browser source.
 *
 * Returns a self-contained, transparent HTML document (NOT a normal page) so it
 * overlays whatever scene you put it on, with no site chrome. It polls
 * /api/pet-feed and crossfades through the approved pictures, each scaled to fit
 * (object-fit: contain). Newly approved pics appear within a few seconds; no
 * manual OBS refresh needed.
 *
 * Paste the full URL (https://<your-app>/pet-feed/overlay) into OBS as a Browser
 * Source — recommended size 1920x1080, "shutdown source when not visible" OFF.
 *
 * Timings come from config (env), so you can tune them without touching code.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getPetFeedConfig();
  const rotateMs = Math.max(2000, Math.round(cfg.rotateSeconds * 1000));
  const fadeMs = Math.max(200, Math.round(cfg.crossfadeMs));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>pet feed overlay</title>
<style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
  #stage { position: fixed; inset: 0; }
  .layer {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain; opacity: 0;
    transition: opacity ${fadeMs}ms ease-in-out;
    will-change: opacity;
  }
  #cap {
    position: fixed; left: 0; right: 0; bottom: 4%;
    text-align: center; padding: 0 4%;
    font: 600 30px/1.25 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: #fff; opacity: 0; transition: opacity 400ms ease;
    text-shadow: 0 2px 10px rgba(0,0,0,.75), 0 0 3px rgba(0,0,0,.9);
    letter-spacing: .01em;
  }
</style>
</head>
<body>
<div id="stage">
  <img id="a" class="layer" alt="" />
  <img id="b" class="layer" alt="" />
  <div id="cap"></div>
</div>
<script>
(function () {
  var ROTATE = ${rotateMs}, POLL = 20000;
  var layers = [document.getElementById('a'), document.getElementById('b')];
  var capEl = document.getElementById('cap');
  var items = [], order = [], oi = 0, front = 0, timer = null;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function show(idx) {
    var it = items[idx];
    if (!it) return;
    var back = 1 - front;
    var bel = layers[back];
    bel.onload = function () {
      bel.style.opacity = 1;
      layers[front].style.opacity = 0;
      front = back;
      if (capEl) {
        var label = it.caption ? (it.pet_name + ' — ' + it.caption) : it.pet_name;
        capEl.textContent = label || '';
        capEl.style.opacity = label ? 1 : 0;
      }
    };
    bel.onerror = function () {}; // skip a broken url silently
    bel.src = it.url;
  }

  function setItems(next) {
    var wasEmpty = items.length === 0;
    items = next;
    order = shuffle(items.map(function (_, i) { return i; }));
    oi = 0;
    if (items.length === 0) {
      layers[0].style.opacity = 0;
      layers[1].style.opacity = 0;
      if (capEl) capEl.style.opacity = 0;
    } else if (wasEmpty) {
      show(order[0]);
      oi = 1;
    }
  }

  function tick() {
    if (items.length > 0) {
      show(order[oi % order.length]);
      oi++;
      if (oi >= order.length) { order = shuffle(order); oi = 0; }
      timer = setTimeout(tick, ROTATE);
    } else {
      timer = setTimeout(tick, 1500);
    }
  }

  function load() {
    fetch('/api/pet-feed', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var next = (d && d.items) || [];
        var changed = next.length !== items.length ||
          next.some(function (x, i) { return !items[i] || items[i].id !== x.id; });
        if (changed) setItems(next);
      })
      .catch(function () {});
  }

  load();
  tick();
  setInterval(load, POLL);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
