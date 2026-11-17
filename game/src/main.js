// Solmar Bay: the entry point. Owns the canvas, the loop, the modes (title / playing /
// paused / game over / win), saving, and the ?shot= staging hook for screenshots.
// The world, the missions and the drawing live in their own modules.
import { createWorld, updateWorld, enterNearestCar, exitCar } from './world.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createInput, ACTION } from './input.js';
import { createAudio } from './audio.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';
import { CAR_MAX_SPEED } from './config.js';

const SAVE_KEY = 'solmar-bay-save-v1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');

const input = createInput(canvas);
const audio = createAudio();
const view = { w: 1280, h: 720 };

function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = view.w;
  canvas.height = view.h;
}
window.addEventListener('resize', resize);
resize();

let state = createWorld(seed);
let missions = createMissions();
let mode = 'title';
let saveExists = false;
let autosaveTimer = 0;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: missions.index,
      cash: state.player.cash,
      health: state.player.health,
      time: state.time,
    }));
  } catch { /* saving is best-effort */ }
}

function newGame() {
  state = createWorld(seed);
  missions = createMissions();
  startMission(state, missions, 0);
  mode = 'playing';
  audio.unlock();
  audio.startMusic();
}

function continueGame(save) {
  state = createWorld(seed);
  missions = createMissions();
  state.player.cash = save.cash || 0;
  state.player.health = save.health || 100;
  startMission(state, missions, Math.min(save.missionIndex || 0, 4));
  mode = 'playing';
  audio.unlock();
  audio.startMusic();
}

function respawn() {
  const cash = state.player.cash;
  const index = missions.index;
  state = createWorld(seed);
  missions = createMissions();
  state.player.cash = cash;
  startMission(state, missions, index);
  mode = 'playing';
}

saveExists = readSave() !== null;

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'gunshot') audio.gunshot();
    else if (e.type === 'crash') audio.crash();
    else if (e.type === 'pickup' && e.amount > 0) audio.pickup();
    else if (e.type === 'missionDone') {
      audio.missionDone();
      writeSave();
    } else if (e.type === 'win') {
      mode = 'win';
      audio.missionDone();
      writeSave();
    }
  }
}

function screenToWorld(mx, my) {
  return { x: mx + state.camera.x, y: my + state.camera.y };
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const pressed = input.consumePressed();
  const mask = input.heldMask();

  if (mode === 'title') {
    if ((pressed & ACTION.CONFIRM) !== 0) {
      const save = readSave();
      if (save) continueGame(save);
      else newGame();
    } else if ((pressed & ACTION.NEW_GAME) !== 0 && readSave()) {
      newGame();
    }
    // Time still advances so the city behind the title stays alive.
    state.time += dt;
  } else if (mode === 'playing') {
    if ((pressed & ACTION.PAUSE) !== 0) {
      mode = 'paused';
      writeSave();
    } else {
      if ((pressed & ACTION.ENTER_CAR) !== 0) {
        if (state.player.onFoot) enterNearestCar(state);
        else exitCar(state);
      }
      const mouse = input.mouse();
      const aim = state.player.onFoot ? screenToWorld(mouse.x, mouse.y) : null;
      const events = [];
      updateWorld(state, dt, mask, pressed, mouse, aim, events);
      updateMissions(state, missions, dt, events);
      handleEvents(events);
      audio.siren(state.wanted > 0);
      audio.engine(state.player.car ? Math.abs(state.player.car.speed) / CAR_MAX_SPEED : 0);
      autosaveTimer += dt;
      if (autosaveTimer > 15) {
        autosaveTimer = 0;
        writeSave();
      }
      if (state.player.health <= 0) {
        mode = 'gameover';
        audio.siren(false);
        audio.stopMusic();
      }
    }
  } else if (mode === 'paused') {
    if ((pressed & ACTION.PAUSE) !== 0 || (pressed & ACTION.CONFIRM) !== 0) mode = 'playing';
  } else if (mode === 'gameover') {
    if ((pressed & ACTION.CONFIRM) !== 0) {
      respawn();
      audio.startMusic();
    }
  } else if (mode === 'win') {
    if ((pressed & ACTION.CONFIRM) !== 0) mode = 'playing';
  }

  draw(ctx, state, missions, view, mode, saveExists);
  requestAnimationFrame(frame);
}

if (shot) {
  // Screenshot staging: paint the scene twice from the real rules, then stop.
  stageShot(shot, seed, ctx, view, updateWorld, draw, missions, audio);
} else {
  requestAnimationFrame(frame);
}
