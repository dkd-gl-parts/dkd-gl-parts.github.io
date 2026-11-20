(function () {
  "use strict";

  window.DcatsCorePallet = function bindCorePallet(api) {
    const label = (key, values = {}) => api.translate("core_pallet_" + key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
    const el = (name) => document.getElementById("core-pallet-" + name);
    const entry = el("entry-dialog");
    const match = el("match-dialog");
    const columns = [
      { name: "pallet_no", label: "col_pallet", length: 80 },
      { name: "part_number", label: "col_part", length: 120 },
      { name: "quantity", label: "col_qty", length: 9 },
      { name: "note", label: "col_note", length: 500 }
    ];
    const compact = window.matchMedia("(max-width: 600px), (max-height: 510px)");
    const state = { rows: [], page: 0, row: null, mode: "link", revision: 0, busy: false, request: null };
    const blank = () => ({ pallet_no: "", part_number: "", quantity: "", note: "" });
    const on = (id, event, listener) => el(id).addEventListener(event, listener);
    const asKey = (value) => String(value || "").trim().normalize("NFKC").toUpperCase();
    const readQuantity = (value) => /^[0-9]{1,9}$/.test(value) ? Number(value) : null;
    const containsInput = (row) => Object.values(row).some((value) => value.trim());
    const unitTotal = (rows) => rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
    ));
    const perPage = () => compact.matches ? 1 : 4;

    function renderEntry() {
      const end = Math.min(state.rows.length, state.page + perPage());
      el("entry-rows").innerHTML = state.rows.slice(state.page, end).map((row, offset) => {
        const index = state.page + offset;
        return '<div class="core-pallet-entry-row" data-row="' + index + '">' +
          '<span class="core-pallet-entry-no">' + (index + 1) + '</span>' +
          columns.map((column) => '<label><span class="core-pallet-entry-mobile-label">' + escape(label(column.label)) + '</span>' +
            '<input type="text" aria-label="' + escape(label("line_field", { row: index + 1, field: label(column.label) })) + '" data-field="' +
            column.name + '" maxlength="' + column.length + '" value="' + escape(row[column.name]) + '"' +
            (column.name === "quantity" ? ' inputmode="numeric"' : '') + '></label>').join("") + '</div>';
      }).join("");
      el("entry-page").textContent = label("line_range", { start: (state.page + 1) + (end === state.page + 1 ? "" : "–" + end), total: state.rows.length });
      el("entry-prev").disabled = state.page === 0;
      el("entry-next").disabled = end === state.rows.length;
      el("entry-add").disabled = state.rows.length >= 100;
    }

    function openEntry() {
      if (!api.canEdit() || state.busy) return;
      state.rows = [blank()];
      state.page = 0;
      state.request = null;
      el("entry-message").textContent = "";
      renderEntry();
      entry.showModal();
      el("entry-rows").querySelector("input").focus();
    }

    function openMatch(row) {
      if (!api.canEdit() || state.busy || !row.entry_key) return;
      state.row = row;
      state.request = null;
      el("match-line").textContent = [row.pallet_no, row.source_part_number, label("units", { qty: row.quantity })].join("  /  ");
      el("adjust-qty").value = String(row.quantity);
      el("adjust-reason").value = "";
      el("link-search").value = row.source_part_number;
      el("link-all").checked = false;
      el("batch-label").hidden = matchingRows().length < 2;
      el("batch-label-text").textContent = label("same_part", { count: matchingRows().length, qty: unitTotal(matchingRows()) });
      resetCandidates();
      setMatchMode(row.quantity > 0 ? "link" : "adjust");
      match.showModal();
      if (state.mode === "link") void findCandidates();
    }

    function matchingRows() {
      return api.pendingRows().filter((row) => row.quantity > 0 &&
        asKey(row.source_part_number) === asKey(state.row.source_part_number));
    }

    function setMatchMode(mode) {
      state.mode = mode;
      el("adjust-controls").hidden = mode !== "adjust";
      el("link-controls").hidden = mode !== "link";
      el("mode-adjust").setAttribute("aria-pressed", String(mode === "adjust"));
      el("mode-link").setAttribute("aria-pressed", String(mode === "link"));
      el("match-save").textContent = mode === "adjust" ? label("save_adjust") : label("save_link");
      el("match-message").textContent = "";
    }

    function resetCandidates() {
      state.revision++;
      el("link-target").replaceChildren(new Option(label("choose"), ""));
      el("link-find").disabled = false;
    }

    async function findCandidates() {
      const query = el("link-search").value.trim();
      resetCandidates();
      const revision = state.revision;
      if (!query) {
        el("match-message").textContent = label("enter_query");
        return;
      }
      el("link-find").disabled = true;
      el("match-message").textContent = label("searching");
      try {
        const result = await api.search(query);
        if (state.revision !== revision || !match.open || state.mode !== "link") return;
        if (result.error) throw result.error;
        const products = result.data || [];
        products.forEach((product) => {
          const numbers = [...new Set([
            product.manufacturer_part_number, product.genuine_part_number, product.genuine_part_number_2
          ].filter(Boolean))];
          const label = ["DKD " + product.dkd_shohin_id, product.manufacturer, ...numbers].filter(Boolean).join(" / ");
          el("link-target").append(new Option(label, String(product.dkd_shohin_id)));
        });
        el("match-message").textContent = products.length ? label("choose_hint") : label("no_product");
      } catch (error) {
        if (state.revision === revision && match.open && state.mode === "link") {
          el("match-message").textContent = label("search_failed");
        }
      } finally {
        if (state.revision === revision) el("link-find").disabled = false;
      }
    }

    function setBusy(busy, dialog) {
      state.busy = busy;
      if (busy) {
        state.disabled = Array.from(dialog.querySelectorAll("button, input, select")).filter((node) => !node.disabled);
        state.disabled.forEach((node) => { node.disabled = true; });
      } else {
        state.disabled.forEach((node) => { node.disabled = false; });
      }
    }

    async function commit(dialog, message, action, rows, productId = null, reason = null) {
      if (state.busy || !api.canEdit()) return;
      const args = { p_action: action, p_rows: rows, p_product_id: productId, p_reason: reason };
      const signature = JSON.stringify(args);
      if (!state.request || state.request.signature !== signature) {
        state.request = { signature, id: window.crypto.randomUUID() };
      }
      setBusy(true, dialog);
      message.textContent = label("saving");
      try {
        const result = await api.write({ ...args, p_request_id: state.request.id });
        if (result.error) throw result.error;
        if (!Array.isArray(result.data?.affected) || result.data.affected.length !== rows.length) {
          throw new Error(label("unconfirmed"));
        }
      } catch (error) {
        message.textContent = error && error.message ? error.message : label("unconfirmed");
        return;
      } finally {
        setBusy(false, dialog);
      }
      dialog.close();
      const labels = { add: "added", adjust: "adjusted", link: "linked" };
      await api.refresh(label(labels[action], { count: rows.length }));
    }

    function saveEntry() {
      const rows = [];
      for (const [index, row] of state.rows.entries()) {
        if (!containsInput(row)) continue;
        const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value.trim()]));
        const quantity = readQuantity(values.quantity);
        if (!values.pallet_no || !values.part_number || quantity == null || quantity < 1) {
          state.page = Math.floor(index / perPage()) * perPage();
          renderEntry();
          el("entry-message").textContent = label("invalid_entry", { row: index + 1 });
          return;
        }
        rows.push({ ...values, quantity });
      }
      if (!rows.length) {
        el("entry-message").textContent = label("empty_entry");
        return;
      }
      void commit(entry, el("entry-message"), "add", rows);
    }

    function saveMatch() {
      const row = state.row;
      const message = el("match-message");
      const selector = (item) => ({ entry_key: item.entry_key, revision: Number(item.revision) });
      if (state.mode === "adjust") {
        const quantity = readQuantity(el("adjust-qty").value);
        const reason = el("adjust-reason").value.trim();
        if (quantity == null || !reason) {
          message.textContent = label("invalid_adjust");
          return;
        }
        void commit(match, message, "adjust", [{ ...selector(row), quantity }], null, reason);
        return;
      }
      const productId = Number(el("link-target").value);
      if (!Number.isSafeInteger(productId) || productId < 1) {
        message.textContent = "紐づけ先の商品を選んでください。";
        return;
      }
      const rows = el("link-all").checked ? matchingRows() : [row];
      if (!rows.length || rows.length > 100 || rows.some((item) => item.quantity < 1)) {
        message.textContent = label("invalid_bulk");
        return;
      }
      void commit(match, message, "link", rows.map(selector), productId);
    }

    on("entry-rows", "input", (event) => {
      const row = event.target.closest("[data-row]");
      if (row && event.target.dataset.field) state.rows[Number(row.dataset.row)][event.target.dataset.field] = event.target.value;
    });
    on("entry-prev", "click", () => { state.page = Math.max(0, state.page - perPage()); renderEntry(); });
    on("entry-next", "click", () => { state.page += perPage(); renderEntry(); });
    on("entry-add", "click", () => {
      if (state.rows.length >= 100) return;
      state.rows.push(blank());
      state.page = Math.floor((state.rows.length - 1) / perPage()) * perPage();
      renderEntry();
      el("entry-rows").querySelectorAll("[data-field='pallet_no']")[state.rows.length - 1 - state.page].focus();
    });
    compact.addEventListener("change", () => {
      if (!entry.open || state.busy) return;
      state.page = Math.floor(state.page / perPage()) * perPage();
      renderEntry();
    });
    on("entry-close", "click", () => entry.close());
    on("entry-linked", "click", () => {
      if (state.rows.some(containsInput)) {
        el("entry-message").textContent = label("switch_prompt");
        return;
      }
      entry.close();
      api.openLinked();
    });
    on("entry-save", "click", saveEntry);
    on("match-close", "click", () => match.close());
    on("match-save", "click", saveMatch);
    on("mode-adjust", "click", () => setMatchMode("adjust"));
    on("mode-link", "click", () => setMatchMode("link"));
    on("link-search", "input", resetCandidates);
    on("link-search", "keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void findCandidates(); }
    });
    on("link-find", "click", findCandidates);
    on("link-target", "change", () => {
      if (!el("link-target").value) return;
      const rows = el("link-all").checked ? matchingRows() : [state.row];
      el("match-message").textContent = label("link_preview", { count: rows.length, qty: unitTotal(rows) });
    });
    on("link-all", "change", () => el("link-target").dispatchEvent(new Event("change")));
    [entry, match].forEach((dialog) => dialog.addEventListener("cancel", (event) => {
      if (state.busy) event.preventDefault();
    }));
    return { openEntry, openMatch };
  };
})();
