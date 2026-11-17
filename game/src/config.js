// Solmar Bay: world layout, palette and tuning constants. One source of truth for the
// city every other module reads, so the map the player explores is the map the minimap draws.
export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROAD_W = 96;
export const ROADS_V = [320, 960, 1600, 2240];
export const ROADS_H = [320, 960, 1600];
export const BEACH_Y = 1760;

export const PLAYER_R = 12;
export const WALK_SPEED = 175;
export const CAR_MAX_SPEED = 430;
export const CAR_ACCEL = 320;
export const CAR_BRAKE = 520;
export const CAR_TURN = 2.6;

export const SPAWN = { x: 480, y: 480 };
export const GARAGE = { x: 2080, y: 480 };
export const DOCKS = { x: 320, y: 1600 };
export const NORTH_POINT = { x: 2240, y: 320 };
export const MARINA = { x: 2240, y: 1700 };

export const PALETTE = {
  grass: '#3f7a44',
  grassDark: '#356b3a',
  road: '#33373d',
  roadLine: '#d8c95a',
  sidewalk: '#8a8d90',
  beach: '#e3c98f',
  water: '#2a6f9e',
  building: ['#c96f4a', '#4a7ec9', '#c9a44a', '#7a4ac9', '#4ac9a4', '#c94a6b', '#8a6b4a'],
  roof: ['#8a4a30', '#2a4a7a', '#8a7a2a', '#4a2a7a', '#2a7a5a', '#7a2a4a', '#5a4a2a'],
  player: '#ffd23f',
  police: '#2a4ad8',
  ped: ['#e8e8e8', '#f2a541', '#7ac74f', '#e26d5a', '#9b7ede', '#5ac8e2'],
  car: ['#d8382a', '#2a7ad8', '#e8b73a', '#38b24a', '#8a8d90', '#e2701d', '#7a3fd0'],
  hud: '#10141b',
};

export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 12;
export const MISSION_REWARDS = [200, 350, 500, 600, 1000];
