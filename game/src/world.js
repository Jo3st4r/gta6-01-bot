// Solmar Bay itself: the seeded city, its cars and pedestrians, the police and the
// wanted system, and the physics that move them. main.js owns the loop and the modes;
// this module owns everything that lives in the world.
import {
  WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_W, BEACH_Y, SPAWN,
  PLAYER_R, WALK_SPEED, CAR_MAX_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_TURN,
  PALETTE, WANTED_MAX, WANTED_DECAY_SECONDS,
} from './config.js';
import { makeRng, clamp, angleDiff, dist2, angleTo } from './random.js';

let carId = 0;

function blockRects(rng) {
  const xs = [0, ...ROADS_V, WORLD_W];
  const ys = [0, ...ROADS_H, BEACH_Y];
  const buildings = [];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + (bi === 0 ? 24 : ROAD_W / 2 + 24);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 24 : ROAD_W / 2 + 24);
      const y0 = ys[bj] + (bj === 0 ? 24 : ROAD_W / 2 + 24);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 24 : ROAD_W / 2 + 24);
      if (x1 - x0 < 140 || y1 - y0 < 140) continue;
      const count = rng.int(1, 2);
      for (let k = 0; k < count; k++) {
        const w = rng.range(90, Math.min(220, x1 - x0 - 20));
        const h = rng.range(90, Math.min(200, y1 - y0 - 20));
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        const c = rng.int(0, PALETTE.building.length - 1);
        buildings.push({ x, y, w, h, color: PALETTE.building[c], roof: PALETTE.roof[c] });
      }
    }
  }
  return buildings;
}

function nearestRoadAxis(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { vertical: true, at: rx }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { vertical: false, at: ry }; }
  }
  return best;
}

function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2 + 6) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2 + 6) return true;
  return false;
}

// Push a circle out of every building AABB it overlaps. Returns true when a push happened.
function pushOutBuildings(state, x, y, r) {
  let pushed = false;
  for (const b of state.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
      pushed = true;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the smallest penetration axis.
      const left = x - b.x, right = b.x + b.w - x;
      const top = y - b.y, bottom = b.y + b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
      pushed = true;
    }
  }
  return { x, y, pushed };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    time: 0,
    buildings: blockRects(rng),
    cars: [],
    peds: [],
    bullets: [],
    cashDrops: [],
    wanted: 0,
    wantedTimer: 0,
    lastCrimeAt: -100,
    lastDamageAt: -100,
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, speed: 0,
      health: 100, cash: 0, onFoot: true, car: null,
      shootCooldown: 0, regenDelay: 0,
    },
    camera: { x: 0, y: 0 },
    stats: { carsStolen: 0, shotsFired: 0, pedsHit: 0 },
  };

  // Parked cars along road edges.
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
    const along = rng.range(140, (vertical ? WORLD_H : WORLD_W) - 260);
    const side = rng.pick([-1, 1]);
    const x = vertical ? road + side * (ROAD_W / 2 + 16) : along;
    const y = vertical ? along : road + side * (ROAD_W / 2 + 16);
    if (y > BEACH_Y - 40) continue;
    state.cars.push({
      id: ++carId, x, y, angle: vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0, color: rng.pick(PALETTE.car), kind: 'parked',
    });
  }
  // Traffic cars driving the roads.
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
    const along = rng.range(100, (vertical ? WORLD_H : WORLD_W) - 100);
    const dir = rng.pick([-1, 1]);
    state.cars.push({
      id: ++carId,
      x: vertical ? road + dir * 22 : along,
      y: vertical ? along : road + dir * 22,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: rng.range(90, 170), color: rng.pick(PALETTE.car), kind: 'traffic',
      road, vertical, dir, cruise: rng.range(90, 170),
    });
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
    const along = rng.range(120, (vertical ? WORLD_H : WORLD_W) - 120);
    const side = rng.pick([-1, 1]);
    const off = ROAD_W / 2 + rng.range(14, 40);
    state.peds.push({
      x: vertical ? road + side * off : along,
      y: vertical ? along : road + side * off,
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(28, 55), color: rng.pick(PALETTE.ped),
      vertical, dir: rng.pick([-1, 1]), down: false,
    });
  }
  return state;
}

export function addWanted(state, n) {
  state.wanted = clamp(state.wanted + n, 0, WANTED_MAX);
  state.lastCrimeAt = state.time;
  state.wantedTimer = 0;
}

export function nearestCar(state, x, y, maxDist, excludePolice = true) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const c of state.cars) {
    if (excludePolice && c.kind === 'police') continue;
    if (c.driver === 'player') continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function spawnPolice(state) {
  const p = state.player;
  const axis = nearestRoadAxis(p.x, p.y);
  const along = axis.vertical
    ? clamp(p.y + (state.rng.chance(0.5) ? -1 : 1) * state.rng.range(420, 640), 80, WORLD_H - 80)
    : clamp(p.x + (state.rng.chance(0.5) ? -1 : 1) * state.rng.range(420, 640), 80, WORLD_W - 80);
  const car = {
    id: ++carId,
    x: axis.vertical ? axis.at : along,
    y: axis.vertical ? along : axis.at,
    angle: angleTo(axis.vertical ? axis.at : along, axis.vertical ? along : axis.at, p.x, p.y),
    speed: 200, color: PALETTE.police, kind: 'police', stun: 0,
  };
  state.cars.push(car);
  return car;
}

function updateTrafficCar(state, c, dt) {
  const ahead = 26;
  let blocked = false;
  for (const o of state.cars) {
    if (o === c || o.kind === 'parked') continue;
    const dx = o.x - c.x, dy = o.y - c.y;
    const forward = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
    const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
    if (forward > 0 && forward < ahead + 30 && side < 26) { blocked = true; break; }
  }
  const target = blocked ? 0 : c.cruise;
  c.speed += clamp(target - c.speed, -260 * dt, 160 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  // Wrap around the world edges and sometimes turn at an intersection.
  const maxAlong = c.vertical ? WORLD_H : WORLD_W;
  const along = c.vertical ? c.y : c.x;
  if (along < 60 || along > maxAlong - 60) {
    const road = c.vertical ? state.rng.pick(ROADS_V) : state.rng.pick(ROADS_H);
    const dir = state.rng.pick([-1, 1]);
    if (c.vertical) { c.x = road + dir * 22; c.y = dir > 0 ? 80 : WORLD_H - 80; c.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { c.y = road + dir * 22; c.x = dir > 0 ? 80 : WORLD_W - 80; c.angle = dir > 0 ? 0 : Math.PI; }
    c.dir = dir;
    c.road = road;
  } else if (state.rng.chance(0.0012)) {
    // Turn onto the crossing road at an intersection.
    const cross = c.vertical ? ROADS_H : ROADS_V;
    let near = null;
    for (const r of cross) if (Math.abs((c.vertical ? c.y : c.x) - r) < 70) { near = r; break; }
    if (near !== null) {
      const dir = state.rng.pick([-1, 1]);
      if (c.vertical) {
        c.y = near + dir * 22; c.x = clamp(c.x, 80, WORLD_W - 80);
        c.angle = dir > 0 ? 0 : Math.PI; c.vertical = false; c.road = near; c.dir = dir;
      } else {
        c.x = near + dir * 22; c.y = clamp(c.y, 80, WORLD_H - 80);
        c.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; c.vertical = true; c.road = near; c.dir = dir;
      }
    }
  }
}

function updatePed(state, p, dt) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const d = dist2(p.x, p.y, px, py);
  if (d < 70 * 70 && !p.down) {
    // Scatter away from the player's car.
    p.angle = angleTo(px, py, p.x, p.y);
    p.speed = 150;
  } else if (p.speed > 60) {
    p.speed = Math.max(40, p.speed - 120 * dt);
  }
  p.x += Math.cos(p.angle) * p.speed * dt;
  p.y += Math.sin(p.angle) * p.speed * dt;
  const maxAlong = p.vertical ? WORLD_H : WORLD_W;
  const along = p.vertical ? p.y : p.x;
  if (along < 80 || along > maxAlong - 80) {
    p.angle += Math.PI;
    if (p.vertical) p.y = clamp(p.y, 80, WORLD_H - 80);
    else p.x = clamp(p.x, 80, WORLD_W - 80);
  }
  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, BEACH_Y - 10);
}

function updatePoliceCar(state, c, dt, events) {
  const p = state.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  if (c.stun > 0) {
    c.stun -= dt;
    c.speed = Math.max(0, c.speed - 300 * dt);
  } else {
    const want = angleTo(c.x, c.y, tx, ty);
    c.angle += clamp(angleDiff(c.angle, want), -2.2 * dt, 2.2 * dt);
    const target = 400;
    c.speed += clamp(target - c.speed, -300 * dt, 240 * dt);
  }
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  const fixed = pushOutBuildings(state, c.x, c.y, 18);
  c.x = fixed.x; c.y = fixed.y;
  c.x = clamp(c.x, 20, WORLD_W - 20);
  c.y = clamp(c.y, 20, BEACH_Y - 10);
  // Ram the player: a hard hit slows the car and hurts the player.
  const d = dist2(c.x, c.y, tx, ty);
  if (d < 34 * 34) {
    if (p.car) {
      p.car.speed *= 0.55;
      c.speed *= 0.5;
      c.x -= Math.cos(c.angle) * 26;
      c.y -= Math.sin(c.angle) * 26;
      events.push({ type: 'crash' });
      damagePlayer(state, 4);
    } else {
      p.x += Math.cos(c.angle) * 30;
      p.y += Math.sin(c.angle) * 30;
      events.push({ type: 'crash' });
      damagePlayer(state, 8);
    }
  }
}

function damagePlayer(state, n) {
  state.player.health = Math.max(0, state.player.health - n);
  state.lastDamageAt = state.time;
}

function updatePlayer(state, dt, mask, pressed, mouse, aim, events) {
  const p = state.player;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  // Health regen after 5 calm seconds.
  if (state.time - state.lastDamageAt > 5 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 2 * dt);
  }
  if (p.car) {
    const car = p.car;
    const up = (mask & 1) !== 0;
    const down = (mask & 2) !== 0;
    const left = (mask & 4) !== 0;
    const right = (mask & 8) !== 0;
    if (up) car.speed += CAR_ACCEL * dt;
    if (down) car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
    if (!up && !down) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    car.speed = clamp(car.speed, -140, CAR_MAX_SPEED);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 12) {
      car.angle += steer * CAR_TURN * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 160, 0.35, 1);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = pushOutBuildings(state, car.x, car.y, 18);
    if (fixed.pushed && Math.abs(car.speed) > 120) events.push({ type: 'crash' });
    if (fixed.pushed) car.speed *= 0.5;
    car.x = fixed.x; car.y = fixed.y;
    car.x = clamp(car.x, 20, WORLD_W - 20);
    car.y = clamp(car.y, 20, BEACH_Y - 10);
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    // Running over a pedestrian is a crime.
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26 && Math.abs(car.speed) > 60) {
        ped.down = true;
        state.stats.pedsHit++;
        addWanted(state, 1);
        events.push({ type: 'pedHit' });
      }
    }
  } else {
    const up = (mask & 1) !== 0;
    const down = (mask & 2) !== 0;
    const left = (mask & 4) !== 0;
    const right = (mask & 8) !== 0;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      p.x += mx * WALK_SPEED * dt;
      p.y += my * WALK_SPEED * dt;
      p.angle = Math.atan2(my, mx);
    }
    const fixed = pushOutBuildings(state, p.x, p.y, PLAYER_R);
    p.x = fixed.x; p.y = fixed.y;
    p.x = clamp(p.x, 20, WORLD_W - 20);
    p.y = clamp(p.y, 20, BEACH_Y - 10);
    p.speed = mx !== 0 || my !== 0 ? WALK_SPEED : 0;
    // Aim with the mouse, shoot with Space / click / J.
    if (aim) p.angle = angleTo(p.x, p.y, aim.x, aim.y);
    if ((pressed & 32) !== 0 && p.shootCooldown <= 0) {
      p.shootCooldown = 0.25;
      state.stats.shotsFired++;
      state.bullets.push({
        x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
        vx: Math.cos(p.angle) * 700, vy: Math.sin(p.angle) * 700, life: 0.8,
      });
      addWanted(state, 1);
      events.push({ type: 'gunshot' });
    }
  }
}

function updateBullets(state, dt, events) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
    if (!dead) {
      for (const bd of state.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; break; }
      }
    }
    if (!dead) {
      for (const c of state.cars) {
        if (c.kind === 'police' && dist2(b.x, b.y, c.x, c.y) < 22 * 22) {
          c.stun = 1.2;
          dead = true;
          events.push({ type: 'hit' });
          break;
        }
      }
    }
    b.dead = dead;
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

function updateWanted(state, dt) {
  const police = state.cars.filter((c) => c.kind === 'police');
  const want = Math.min(state.wanted, WANTED_MAX);
  while (police.length < want) police.push(spawnPolice(state));
  while (police.length > want) {
    const c = police.pop();
    state.cars.splice(state.cars.indexOf(c), 1);
  }
  // Heat fades after a calm stretch with no police nearby.
  if (state.wanted > 0 && state.time - state.lastCrimeAt > WANTED_DECAY_SECONDS) {
    const p = state.player;
    const near = police.some((c) => dist2(c.x, c.y, p.x, p.y) < 320 * 320);
    if (!near) {
      state.wantedTimer += dt;
      if (state.wantedTimer > 8) {
        state.wanted--;
        state.wantedTimer = 0;
        state.lastCrimeAt = state.time;
      }
    } else {
      state.wantedTimer = 0;
    }
  }
}

export function updateWorld(state, dt, mask, pressed, mouse, aim, events) {
  state.time += dt;
  updatePlayer(state, dt, mask, pressed, mouse, aim, events);
  for (const c of state.cars) {
    if (c.kind === 'traffic') updateTrafficCar(state, c, dt);
    else if (c.kind === 'police') updatePoliceCar(state, c, dt, events);
  }
  for (const p of state.peds) updatePed(state, p, dt);
  updateBullets(state, dt, events);
  updateWanted(state, dt);
  // Cash drops picked up by walking or driving over them.
  for (const drop of state.cashDrops) {
    if (drop.taken) continue;
    const p = state.player;
    if (dist2(drop.x, drop.y, p.x, p.y) < 30 * 30) {
      drop.taken = true;
      p.cash += drop.amount;
      events.push({ type: 'pickup', amount: drop.amount });
    }
  }
  state.cashDrops = state.cashDrops.filter((d) => !d.taken);
  // Fallen pedestrians get back up after a while, away from the road.
  for (const p of state.peds) {
    if (p.down && state.rng.chance(dt * 0.1)) {
      p.down = false;
      const axis = nearestRoadAxis(p.x, p.y);
      if (axis.vertical) p.x = axis.at + (p.x > axis.at ? 1 : -1) * (ROAD_W / 2 + 30);
      else p.y = axis.at + (p.y > axis.at ? 1 : -1) * (ROAD_W / 2 + 30);
    }
  }
}

export function enterNearestCar(state) {
  const p = state.player;
  if (!p.onFoot) return false;
  const car = nearestCar(state, p.x, p.y, 64);
  if (!car) return false;
  car.kind = car.kind === 'parked' ? 'player' : car.kind;
  car.driver = 'player';
  car.cruise = 0;
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  state.stats.carsStolen++;
  addWanted(state, 1);
  return true;
}

export function exitCar(state) {
  const p = state.player;
  if (p.onFoot || !p.car) return false;
  const car = p.car;
  car.driver = null;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  const fixed = pushOutBuildings(state, p.x, p.y, PLAYER_R);
  p.x = clamp(fixed.x, 20, WORLD_W - 20);
  p.y = clamp(fixed.y, 20, BEACH_Y - 10);
  p.car = null;
  p.onFoot = true;
  p.speed = 0;
  return true;
}

export { onRoad, nearestRoadAxis };
