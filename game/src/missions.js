// The five story missions: Rico Vega against the Marlin crew. Each mission is a short
// chain of steps over the city; finishing one pays cash and opens the next, and the
// fifth ends the game. Missions only read and write the world state — they never draw.
import { GARAGE, DOCKS, NORTH_POINT, MARINA, MISSION_REWARDS } from './config.js';
import { addWanted } from './world.js';
import { dist2 } from './random.js';

export const MISSION_TITLES = [
  '1. First Wheels',
  '2. The Pickup',
  '3. Marlin Heat',
  '4. Shakedown',
  '5. The Last Score',
];

const CHECKPOINTS_3 = [
  { x: 960, y: 320, label: 'Checkpoint A' },
  { x: 1600, y: 1600, label: 'Checkpoint B' },
  { x: 320, y: 960, label: 'Checkpoint C' },
];
const DROPS_4 = [
  { x: 960, y: 1600, label: 'Cash drop' },
  { x: 2240, y: 960, label: 'Cash drop' },
  { x: 1600, y: 320, label: 'Cash drop' },
];

export function createMissions() {
  return {
    index: 0,
    step: 0,
    markers: [],
    text: '',
    waitTimer: 0,
    done: false,
    started: false,
  };
}

function setMarkers(missions, markers) {
  missions.markers = markers.map((m) => ({ ...m, r: 44, reached: false }));
}

export function startMission(state, missions, index) {
  missions.index = index;
  missions.step = 0;
  missions.waitTimer = 0;
  missions.started = true;
  if (index === 0) {
    missions.text = 'Steal a car — walk up to one and press E.';
    setMarkers(missions, []);
  } else if (index === 1) {
    missions.text = 'Drive to the docks pickup.';
    setMarkers(missions, [{ ...DOCKS, label: 'Docks pickup' }]);
  } else if (index === 2) {
    addWanted(state, 3);
    missions.text = 'The Marlins sent the heat. Hit all 3 checkpoints.';
    setMarkers(missions, CHECKPOINTS_3);
  } else if (index === 3) {
    missions.text = 'Collect all 3 cash drops around the city.';
    setMarkers(missions, DROPS_4);
    state.cashDrops = DROPS_4.map((d) => ({ x: d.x, y: d.y, amount: 200, taken: false }));
  } else if (index === 4) {
    addWanted(state, 4);
    missions.text = 'Final run: reach the yacht at the marina.';
    setMarkers(missions, [{ ...MARINA, label: 'The yacht' }]);
  }
}

function completeMission(state, missions, events) {
  const reward = MISSION_REWARDS[missions.index];
  state.player.cash += reward;
  events.push({ type: 'missionDone', reward, title: MISSION_TITLES[missions.index] });
  if (missions.index >= 4) {
    missions.done = true;
    events.push({ type: 'win' });
    return;
  }
  startMission(state, missions, missions.index + 1);
}

function reached(state, marker) {
  const p = state.player;
  return dist2(marker.x, marker.y, p.x, p.y) < marker.r * marker.r;
}

export function updateMissions(state, missions, dt, events) {
  if (!missions.started || missions.done) return;
  const i = missions.index;
  if (i === 0) {
    if (missions.step === 0) {
      if (!state.player.onFoot) {
        missions.step = 1;
        missions.text = 'Nice wheels. Now drive to the garage.';
        setMarkers(missions, [{ ...GARAGE, label: 'Garage' }]);
        events.push({ type: 'mission', text: missions.text });
      }
    } else if (reached(state, missions.markers[0])) {
      completeMission(state, missions, events);
    }
  } else if (i === 1) {
    if (missions.step === 0) {
      if (reached(state, missions.markers[0])) {
        missions.step = 1;
        missions.waitTimer = 2;
        missions.text = 'Grabbing the package…';
        setMarkers(missions, []);
      }
    } else if (missions.step === 1) {
      missions.waitTimer -= dt;
      if (missions.waitTimer <= 0) {
        missions.step = 2;
        missions.text = 'Package secured. Deliver it up north.';
        setMarkers(missions, [{ ...NORTH_POINT, label: 'Drop-off' }]);
        events.push({ type: 'mission', text: missions.text });
      }
    } else if (reached(state, missions.markers[0])) {
      completeMission(state, missions, events);
    }
  } else if (i === 2) {
    let all = true;
    for (const m of missions.markers) {
      if (!m.reached && reached(state, m)) {
        m.reached = true;
        events.push({ type: 'pickup', amount: 0 });
      }
      if (!m.reached) all = false;
    }
    if (all) completeMission(state, missions, events);
  } else if (i === 3) {
    if (state.cashDrops.length === 0) completeMission(state, missions, events);
  } else if (i === 4) {
    if (reached(state, missions.markers[0])) completeMission(state, missions, events);
  }
}

export function missionObjective(missions) {
  if (missions.done) return 'All missions complete — Solmar Bay is yours, Rico.';
  return `${MISSION_TITLES[missions.index]} — ${missions.text}`;
}
