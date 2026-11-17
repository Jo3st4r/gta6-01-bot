// Everything the player sees: the city, the cars, the HUD with its live minimap, and
// the title / pause / game-over / win screens. Pure drawing — no game logic lives here.
import {
  WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_W, BEACH_Y, PALETTE,
} from './config.js';
import { clamp } from './random.js';
import { MISSION_TITLES, missionObjective } from './missions.js';

function drawCar(ctx, x, y, angle, color, isPolice) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-24, -13, 48, 26);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-22, -11, 44, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.roundRect(-6, -9, 14, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#1b1e24';
  ctx.fillRect(14, -9, 4, 4);
  ctx.fillRect(14, 5, 4, 4);
  ctx.fillRect(-20, -9, 4, 4);
  ctx.fillRect(-20, 5, 4, 4);
  if (isPolice) {
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(-14, -12, 8, 4);
    ctx.fillStyle = '#2a7aff';
    ctx.fillRect(6, -12, 8, 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(2, 3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1e24';
  ctx.beginPath();
  ctx.arc(5, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2e35';
  ctx.fillRect(8, -3, 9, 6);
  ctx.restore();
}

function drawMinimap(ctx, state, missions, viewW) {
  const w = 220, h = 164;
  const x0 = viewW - w - 16, y0 = 16;
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y0 - 6, w + 12, h + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0 + BEACH_Y * sy, w, h - BEACH_Y * sy);
  ctx.strokeStyle = PALETTE.road;
  ctx.lineWidth = Math.max(2, ROAD_W * sx);
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + h); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + w, y0 + ry * sy); ctx.stroke();
  }
  for (const m of missions.markers) {
    if (m.reached) continue;
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#39d353';
    ctx.beginPath();
    ctx.arc(x0 + m.x * sx, y0 + m.y * sy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of state.cars) {
    if (c.kind === 'police') {
      ctx.fillStyle = '#4a7dff';
      ctx.beginPath();
      ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = PALETTE.player;
  ctx.strokeStyle = '#10141b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x0, y0 + h + 18);
  ctx.restore();
}

function drawHud(ctx, state, missions, viewW) {
  const p = state.player;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 250, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 40);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 50, 140, 10);
  ctx.fillStyle = p.health > 50 ? '#39d353' : p.health > 25 ? '#e8b73a' : '#d8382a';
  ctx.fillRect(26, 50, 140 * clamp(p.health / 100, 0, 1), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 172, 59);
  // Wanted stars.
  ctx.font = '20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
  ctx.fillStyle = state.wanted > 0 ? '#ffd23f' : '#8a8d90';
  ctx.fillText(stars, 26, 88);
  // Mission objective bar.
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  const obj = missionObjective(missions);
  ctx.font = '14px sans-serif';
  const tw = ctx.measureText(obj).width;
  ctx.beginPath();
  ctx.roundRect(12, 108, tw + 28, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(obj, 26, 128);
  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E steal car · Space/J shoot · P pause', 26, 158);
  ctx.restore();
  drawMinimap(ctx, state, missions, viewW);
}

function drawTitle(ctx, state, viewW, viewH, saveExists) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', viewW / 2, viewH / 2 - 110);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in the spirit of GTA 6', viewW / 2, viewH / 2 - 70);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#c9ced6';
  ctx.fillText('Rico Vega is back in Solmar Bay. The Marlin crew runs the streets.', viewW / 2, viewH / 2 - 38);
  ctx.fillText('Steal cars, dodge the law, run five missions — and take the city back.', viewW / 2, viewH / 2 - 14);
  ctx.fillStyle = '#39d353';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(saveExists ? 'Press ENTER to continue — or N for a new game' : 'Press ENTER to start', viewW / 2, viewH / 2 + 40);
  ctx.fillStyle = '#8a8d90';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD / arrows — move & drive · E — steal / exit car · Space / J / click — shoot · P — pause', viewW / 2, viewH / 2 + 76);
  ctx.fillText('5 missions · wanted stars · police chases · save & autosave', viewW / 2, viewH / 2 + 100);
  ctx.restore();
}

function drawCenterScreen(ctx, viewW, viewH, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.78)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(title, viewW / 2, viewH / 2 - 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH / 2 + 6 + i * 28));
  ctx.restore();
}

export function draw(ctx, state, missions, view, mode, saveExists) {
  const viewW = view.w, viewH = view.h;
  const p = state.player;
  const camX = clamp(p.x - viewW / 2, 0, Math.max(0, WORLD_W - viewW));
  const camY = clamp(p.y - viewH / 2, 0, Math.max(0, WORLD_H - viewH));
  state.camera.x = camX;
  state.camera.y = camY;

  ctx.save();
  ctx.translate(-camX, -camY);
  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = PALETTE.grassDark;
  for (let gx = 0; gx < WORLD_W; gx += 160) {
    for (let gy = 0; gy < WORLD_H; gy += 160) {
      if (((gx + gy) / 160) % 2 === 0) ctx.fillRect(gx, gy, 160, 160);
    }
  }
  // Beach and water.
  ctx.fillStyle = PALETTE.beach;
  ctx.fillRect(0, BEACH_Y, WORLD_W, 100);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, BEACH_Y + 100, WORLD_W, WORLD_H - BEACH_Y - 100);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let wx = 40; wx < WORLD_W; wx += 180) ctx.fillRect(wx, BEACH_Y + 130, 90, 4);
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
  for (const ry of ROADS_H) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_V) {
    ctx.fillRect(rx - ROAD_W / 2 - 10, 0, 10, BEACH_Y);
    ctx.fillRect(rx + ROAD_W / 2, 0, 10, BEACH_Y);
  }
  for (const ry of ROADS_H) {
    ctx.fillRect(0, ry - ROAD_W / 2 - 10, WORLD_W, 10);
    ctx.fillRect(0, ry + ROAD_W / 2, WORLD_W, 10);
  }
  // Road centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of ROADS_V) {
    for (let y = 20; y < BEACH_Y; y += 64) ctx.fillRect(rx - 2, y, 4, 32);
  }
  for (const ry of ROADS_H) {
    for (let x = 20; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 32, 4);
  }
  // Buildings.
  for (const b of state.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
  }
  // Mission markers.
  for (const m of missions.markers) {
    if (m.reached) continue;
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#39d353';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(57,211,83,0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#39d353';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label || '', m.x, m.y - m.r - 10);
  }
  // Cash drops.
  for (const d of state.cashDrops) {
    ctx.save();
    ctx.translate(d.x, d.y + Math.sin(state.time * 4) * 3);
    ctx.fillStyle = '#39d353';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 5);
    ctx.restore();
  }
  // Cars.
  for (const c of state.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, c.kind === 'police');
  // Pedestrians.
  for (const ped of state.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(1, 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1e24';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  if (p.onFoot) drawPlayer(ctx, p.x, p.y, p.angle, PALETTE.player);
  ctx.restore();

  // HUD and screens live in screen space.
  if (mode === 'playing' || mode === 'paused') drawHud(ctx, state, missions, viewW);
  if (mode === 'title') drawTitle(ctx, state, viewW, viewH, saveExists);
  if (mode === 'paused') {
    drawCenterScreen(ctx, viewW, viewH, 'PAUSED', ['Press P to resume', 'Progress autosaves as you play'], '#ffffff');
  }
  if (mode === 'gameover') {
    drawCenterScreen(ctx, viewW, viewH, 'BUSTED', [`Rico went down with $${p.cash} in his pocket.`, 'Press ENTER to try again'], '#d8382a');
  }
  if (mode === 'win') {
    drawCenterScreen(ctx, viewW, viewH, 'SOLMAR BAY IS YOURS', [
      `All five missions complete. Rico Vega owns the city — $${p.cash} richer.`,
      'Press ENTER to keep cruising the city',
    ], '#39d353');
  }
}

export { MISSION_TITLES };
