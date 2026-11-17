// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the real
// rules forward from a seeded state and paints the scene twice, then sets
// window.__shotReady so the screenshot tool knows the frame is final.
import { createWorld, addWanted, enterNearestCar } from './world.js';
import { startMission } from './missions.js';

function stepWorld(state, missions, update, dt, steps) {
  for (let i = 0; i < steps; i++) {
    update(state, dt, 0, 0, null, null, []);
    if (missions) {
      // Missions advance only off markers; staged scenes keep their own markers.
    }
  }
}

export function stageShot(kind, seed, ctx, view, update, draw, missions, audio) {
  const state = createWorld(seed);
  const p = state.player;
  if (kind === 'start') {
    // Title screen over a slow city view: Rico on foot near the beach road.
    p.x = 960; p.y = 1500;
    p.angle = -Math.PI / 2;
    stepWorld(state, null, update, 1 / 60, 30);
    draw(ctx, state, missions, view, 'title', false);
    draw(ctx, state, missions, view, 'title', false);
  } else if (kind === 'play') {
    // Rico driving east on the main road, traffic and pedestrians around him.
    startMission(state, missions, 0);
    p.x = 900; p.y = 960 + 22;
    let car = null;
    let bestD = Infinity;
    for (const c of state.cars) {
      if (c.kind !== 'parked') continue;
      const d = (c.x - 900) * (c.x - 900) + (c.y - 982) * (c.y - 982);
      if (d < bestD) { bestD = d; car = c; }
    }
    if (car) {
      car.x = 900; car.y = 982; car.angle = 0;
      p.x = car.x; p.y = car.y;
      enterNearestCar(state);
      state.wanted = 0;
      state.lastCrimeAt = state.time;
      state.cars = state.cars.filter((c) => c.kind !== 'police');
    }
    missions.step = 1;
    missions.text = 'Nice wheels. Now drive to the garage.';
    missions.markers = [{ x: 2080, y: 480, r: 44, label: 'Garage', reached: false }];
    stepWorld(state, missions, update, 1 / 60, 90);
    draw(ctx, state, missions, view, 'playing', false);
    draw(ctx, state, missions, view, 'playing', false);
  } else if (kind === 'chase') {
    // Three-star heat: two police cars on Rico's tail, wanted stars lit on the HUD.
    startMission(state, missions, 2);
    p.x = 1500; p.y = 960 + 22;
    const car = state.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.x = 1500; car.y = 982; car.angle = 0;
      p.x = car.x; p.y = car.y;
      enterNearestCar(state);
    }
    state.wanted = 3;
    state.lastCrimeAt = state.time;
    addWanted(state, 0);
    stepWorld(state, missions, update, 1 / 60, 150);
    draw(ctx, state, missions, view, 'playing', false);
    draw(ctx, state, missions, view, 'playing', false);
  } else {
    // The win screen: all five missions done, Rico's final score on screen.
    missions.index = 4;
    missions.done = true;
    missions.started = true;
    p.cash = 2450;
    p.x = 2240; p.y = 1700;
    stepWorld(state, null, update, 1 / 60, 30);
    draw(ctx, state, missions, view, 'win', false);
    draw(ctx, state, missions, view, 'win', false);
  }
  window.__shotReady = true;
  return state;
}
