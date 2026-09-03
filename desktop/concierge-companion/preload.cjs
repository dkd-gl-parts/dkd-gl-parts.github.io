"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const CHANNEL_STATE = "dcats-concierge:state";
const CHANNEL_SHOW_MENU = "dcats-concierge:show-menu";

contextBridge.exposeInMainWorld("dcatsCompanion", Object.freeze({
  onState(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on(CHANNEL_STATE, listener);
    return () => ipcRenderer.removeListener(CHANNEL_STATE, listener);
  },
  showMenu() {
    ipcRenderer.send(CHANNEL_SHOW_MENU);
  }
}));
