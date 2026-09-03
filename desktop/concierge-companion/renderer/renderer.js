"use strict";

(function () {
  const CHARACTER_NAMES = Object.freeze({ suzuto: "スズト", rinna: "リンナ" });
  const MODES = new Set(["active", "horizontal", "vertical", "fixed", "off"]);
  const SIZES = new Set(["small", "normal", "large"]);
  const sprite = document.querySelector(".pet-sprite");

  function applyState(value) {
    const state = value && typeof value === "object" ? value : {};
    const character = CHARACTER_NAMES[state.character] ? state.character : "suzuto";
    const mode = MODES.has(state.mode) ? state.mode : "active";
    const size = SIZES.has(state.size) ? state.size : "normal";
    const facing = state.facing === "left" ? "left" : "right";
    document.body.dataset.character = character;
    document.body.dataset.mode = mode;
    document.body.dataset.size = size;
    document.body.dataset.facing = facing;
    sprite.classList.toggle("is-suzuto", character === "suzuto");
    sprite.classList.toggle("is-rinna", character === "rinna");
    sprite.setAttribute("aria-label", CHARACTER_NAMES[character]);
  }

  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.dcatsCompanion.showMenu();
  });

  window.dcatsCompanion.onState(applyState);
}());
