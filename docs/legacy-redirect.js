// Serve only from the legacy GitHub Pages origin; never redirect the primary app.
(() => {
  "use strict";
  const legacyOrigin = "https://dkd-gl-parts.github.io";
  const canonicalOrigin = "https://dcats.daiko-denki.co.jp";
  const source = window.location;
  if (source.origin !== legacyOrigin) return;

  // Assign URL components separately: a pathname beginning with // must never
  // be parsed as a new authority. Preserve browser-parsed query and fragment.
  const target = new URL(canonicalOrigin + "/");
  target.pathname = source.pathname;
  target.search = source.search;
  target.hash = source.hash;
  if (target.origin !== canonicalOrigin || target.protocol !== "https:") return;
  source.replace(target.href);
})();
