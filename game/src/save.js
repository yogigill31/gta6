// Save and load through localStorage: cash, mission progress, lifetime stats.
// A save from another visit lets the title screen offer Continue.
import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The shape a fresh save has: no story progress, no cash, no record yet. */
export function freshSave() {
  return {
    cash: 0,
    missionIndex: 0,
    missionsDone: 0,
    bestCash: 0,
    kills: 0,
    carsStolen: 0,
    busted: 0,
    wasted: 0,
    storyDone: false,
  };
}
