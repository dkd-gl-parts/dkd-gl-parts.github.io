"use strict";

(function () {
  const CHARACTER_NAMES = Object.freeze({ suzuto: "スズト", rinna: "リンナ" });
  const TRAVEL_ROWS = Object.freeze({
    suzuto: Object.freeze({ right: 1, left: 2 }),
    rinna: Object.freeze({ right: 1, left: 2 })
  });
  const IDLE_DURATIONS = Object.freeze([280, 110, 110, 140, 140, 320]);
  const TRAVEL_DURATIONS = Object.freeze([120, 120, 120, 120, 120, 120, 120, 220]);
  const STOP_GESTURES = Object.freeze({
    settle: Object.freeze({ column: 0, enter: 180, hold: 620, exit: 260 }),
    bow: Object.freeze({ column: 1, enter: 260, hold: 850, exit: 320 }),
    escort: Object.freeze({ column: 2, enter: 260, hold: 1000, exit: 300 }),
    handshake: Object.freeze({ column: 3, enter: 260, hold: 1100, exit: 320 }),
    shy: Object.freeze({ column: 4, enter: 300, hold: 1000, exit: 350 }),
    welcome: Object.freeze({ column: 5, enter: 260, hold: 950, exit: 320 })
  });
  const MODES = new Set(["active", "horizontal", "vertical", "fixed", "off"]);
  const SIZES = new Set(["small", "normal", "large"]);
  const sprite = document.querySelector(".pet-sprite");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let spriteAnimation = null;
  let currentVisualKey = "";
  let currentState = null;

  function backgroundPosition(row, column) {
    return `${column * 100 / 7}% ${row * 100 / 10}%`;
  }

  function showFrame(row, column) {
    if (spriteAnimation) spriteAnimation.cancel();
    const position = backgroundPosition(row, column);
    currentVisualKey = `frame:${row}:${column}`;
    spriteAnimation = sprite.animate([
      { backgroundPosition: position },
      { backgroundPosition: position }
    ], { duration: 1, fill: "forwards" });
  }

  function playRow(row, durations) {
    const visualKey = `row:${row}:${durations.length}`;
    if (currentVisualKey === visualKey && spriteAnimation && spriteAnimation.playState === "running") return;
    if (spriteAnimation) spriteAnimation.cancel();
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    let elapsed = 0;
    const frames = durations.map((duration, column) => {
      const frame = {
        offset: elapsed / total,
        backgroundPosition: backgroundPosition(row, column),
        easing: "steps(1, end)"
      };
      elapsed += duration;
      return frame;
    });
    frames.push({
      offset: 1,
      backgroundPosition: backgroundPosition(row, durations.length - 1),
      easing: "steps(1, end)"
    });
    currentVisualKey = visualKey;
    spriteAnimation = sprite.animate(frames, { duration: total, iterations: Infinity, fill: "forwards" });
  }

  function playStopGesture(name, gesture) {
    const visualKey = `stop:${name}`;
    if (currentVisualKey === visualKey && spriteAnimation && spriteAnimation.playState === "running") return;
    if (spriteAnimation) spriteAnimation.cancel();
    const total = gesture.enter + gesture.hold + gesture.exit;
    const idlePosition = backgroundPosition(0, 0);
    const targetPosition = backgroundPosition(8, gesture.column);
    const frames = [
      { offset: 0, backgroundPosition: idlePosition, easing: "steps(1, end)" },
      { offset: gesture.enter / total, backgroundPosition: targetPosition, easing: "steps(1, end)" },
      { offset: (gesture.enter + gesture.hold) / total, backgroundPosition: targetPosition, easing: "steps(1, end)" },
      { offset: 1, backgroundPosition: idlePosition, easing: "steps(1, end)" }
    ];
    currentVisualKey = visualKey;
    const animation = sprite.animate(frames, { duration: total, iterations: 1, fill: "forwards" });
    spriteAnimation = animation;
    animation.finished.then(() => {
      if (spriteAnimation !== animation || !currentState || currentState.moving || currentState.restGesture !== name) return;
      currentVisualKey = "";
      playRow(0, IDLE_DURATIONS);
    }).catch(() => {});
  }

  function syncSpriteMotion(character, mode, facing, moving, restGesture) {
    if (mode === "off" || reduceMotionQuery.matches) {
      showFrame(0, 0);
      return;
    }
    if (mode === "fixed") {
      playRow(0, IDLE_DURATIONS);
      return;
    }
    if (moving) {
      playRow(TRAVEL_ROWS[character][facing], TRAVEL_DURATIONS);
      return;
    }
    const gesture = STOP_GESTURES[restGesture];
    if (gesture) playStopGesture(restGesture, gesture);
    else playRow(0, IDLE_DURATIONS);
  }

  function applyState(value) {
    const state = value && typeof value === "object" ? value : {};
    const character = CHARACTER_NAMES[state.character] ? state.character : "suzuto";
    const mode = MODES.has(state.mode) ? state.mode : "active";
    const size = SIZES.has(state.size) ? state.size : "normal";
    const facing = state.facing === "left" ? "left" : "right";
    const moving = state.moving === true;
    const restGesture = STOP_GESTURES[state.restGesture] ? state.restGesture : "idle";
    document.body.dataset.character = character;
    document.body.dataset.mode = mode;
    document.body.dataset.size = size;
    document.body.dataset.facing = facing;
    document.body.dataset.moving = moving ? "true" : "false";
    document.body.dataset.restGesture = restGesture;
    sprite.classList.toggle("is-suzuto", character === "suzuto");
    sprite.classList.toggle("is-rinna", character === "rinna");
    sprite.setAttribute("aria-label", CHARACTER_NAMES[character]);
    currentState = { character, mode, size, facing, moving, restGesture };
    syncSpriteMotion(character, mode, facing, moving, restGesture);
  }

  reduceMotionQuery.addEventListener("change", () => {
    currentVisualKey = "";
    if (currentState) applyState(currentState);
  });

  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.dcatsCompanion.showMenu();
  });

  window.dcatsCompanion.onState(applyState);
}());
