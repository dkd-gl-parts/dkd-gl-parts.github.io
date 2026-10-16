(function () {
  "use strict";
  // A fixed route, not an AI-provided URL or function. No data mutation lives here.
  function create(options) {
    var dirtyScreens = new Set(), pending = false, generation = 0;
    var doc = options.document;
    function context() { return options.context() || {}; }
    function same(a, b) { return a.id && a.id === b.id && a.admin === true && b.admin === true && a.stamp === b.stamp; }
    function route(id) {
      return typeof id === "string" && Object.prototype.hasOwnProperty.call(options.routes, id) ? options.routes[id] : null;
    }
    function describe(id) {
      try {
      var c = context(), r = route(id);
      if (!c.id || !c.admin || !r || !r.allowed() || options.activeScreen() === (r.destination || id)) return null;
      var label = options.label(r.destination || id);
      return typeof label === "string" && label ? { screenId: id, label: label, contextKey: options.navigationContext ? options.navigationContext(id) : "" } : null;
      } catch (error) { return null; }
    }
    function edited(event) {
      var n = event.target;
      if (!n || !/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) || !n.closest) return;
      var screen = n.closest(".screen");
      if (screen && /^screen-/.test(screen.id)) dirtyScreens.add(screen.id.slice(7));
    }
    doc.addEventListener("input", edited, true);
    doc.addEventListener("change", edited, true);
    async function open(id, caller) {
      if (pending) return { data: null, error: new Error("screen_open_busy") };
      var r = route(id), start = context(), source = options.activeScreen(), token = generation;
      function current() { return token === generation && same(start, context()) && caller && typeof caller.isCurrent === "function" && caller.isCurrent() && options.activeScreen() === source; }
      function ready() {
        if (!current()) throw new Error("screen_open_stale");
        if (options.navigationContext && (!caller || caller.contextKey !== options.navigationContext(id))) throw new Error("screen_open_stale");
        if (!r || !r.allowed()) throw new Error("screen_open_unavailable");
        if (dirtyScreens.has(source) || dirtyScreens.has(id) || dirtyScreens.has(r.destination || id) || options.busy()) throw new Error("screen_open_draft");
      }
      pending = true;
      try {
        ready();
        if (source === (r.destination || id)) return { data: { ok: true, screen_id: id, already_open: true }, error: null };
        var deadline;
        try {
          await Promise.race([options.authorize(start, id), new Promise(function (_, reject) { deadline = setTimeout(function () { reject(new Error("screen_open_unavailable")); }, 10000); })]);
        } finally { clearTimeout(deadline); }
        ready(); // Includes edits, permission changes and navigation during Auth reads.
        await r.open();
        if (!same(start, context()) || token !== generation || options.activeScreen() !== (r.destination || id)) throw new Error("screen_open_stale");
        return { data: { ok: true, screen_id: id }, error: null };
      } catch (error) {
        var code = error && error.message;
        return { data: null, error: new Error(/^screen_open_(busy|stale|unavailable|draft|forbidden)$/.test(code) ? code : "screen_open_unavailable") };
      } finally { if (token === generation) pending = false; }
    }
    return Object.freeze({ describe: describe, open: open, resetScreen: function (id) { dirtyScreens.delete(id); }, clear: function () { generation++; pending = false; dirtyScreens.clear(); } });
  }
  window.DcatsConciergeNav = Object.freeze({ create: create });
}());
