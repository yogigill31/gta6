// Drawing only: the world's state in, pixels out. The 1280x720 playfield is scaled
// to fit the window and centred. A camera follows the player across Port Meridian;
// buildings get a sun-side shadow so the flat city reads as a place. Every car,
// person and sign is drawn procedurally — no images, no fonts beyond the system stack.
import { CITY_H, CITY_W, COLS, FONT, PALETTE, ROWS, STREET, VIEW } from './config.js';
import { lightGreenNS, roadX, roadY } from './city.js';
import { drawEnd, drawHelp, drawHud, drawPaused, drawTitle } from './hud.js';
import { shakeOffset } from './particles.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_END = 'end';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function camera(world) {
    const p = world.entities.player;
    const focus = p.car ? p.car : p;
    const shake = shakeOffset(world.particles);
    let cx = focus.x - VIEW.width / 2 + shake.x;
    let cy = focus.y - VIEW.height / 2 + shake.y;
    cx = Math.max(0, Math.min(CITY_W - VIEW.width, cx));
    cy = Math.max(0, Math.min(CITY_H + 110 - VIEW.height, cy));
    return { x: cx, y: cy };
  }

  /** Sunlight tint for the hour: bright day, orange dusk, dark blue night. */
  function daylight(clock) {
    if (clock >= 9 && clock < 16.5) return null;
    if (clock >= 16.5 && clock < 18.5) return { color: '255,140,40', alpha: 0.10 + (clock - 16.5) * 0.05 };
    if (clock >= 18.5 && clock < 20) return { color: '40,60,140', alpha: 0.12 + (clock - 18.5) * 0.1 };
    if (clock >= 20 || clock < 5.5) return { color: '10,20,60', alpha: 0.34 };
    if (clock >= 5.5 && clock < 7.5) return { color: '255,170,90', alpha: 0.16 - (clock - 5.5) * 0.06 };
    return { color: '255,220,150', alpha: 0.05 };
  }

  function drawCity(ctx, world, cam) {
    const { city } = world;
    ctx.fillStyle = '#6b7a52';
    ctx.fillRect(cam.x - 40, cam.y - 40, VIEW.width + 80, VIEW.height + 80);
    // Harbour water along the south edge.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(cam.x - 40, city.water.y, VIEW.width + 80, city.water.height + 40);
    for (const boat of city.boats) {
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      ctx.fillStyle = boat.color;
      ctx.fillRect(-34, -10, 68, 20);
      ctx.fillStyle = '#2a2f38';
      ctx.fillRect(-10, -16, 22, 10);
      ctx.restore();
    }
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = park.kind === 'docks' ? '#7a6a4a' : PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      if (park.name) text(park.name, park.x + park.w / 2, park.y + 24, 15, 'rgba(255,255,255,0.5)', 'center');
    }
    // Sidewalks, then roads, then centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let j = 0; j <= ROWS; j += 1) ctx.fillRect(cam.x - 40, roadY(j) - STREET / 2 - 8, VIEW.width + 80, STREET + 16);
    for (let i = 0; i <= COLS; i += 1) ctx.fillRect(roadX(i) - STREET / 2 - 8, cam.y - 40, STREET + 16, VIEW.height + 80);
    ctx.fillStyle = PALETTE.road;
    for (let j = 0; j <= ROWS; j += 1) ctx.fillRect(cam.x - 40, roadY(j) - STREET / 2, VIEW.width + 80, STREET);
    for (let i = 0; i <= COLS; i += 1) ctx.fillRect(roadX(i) - STREET / 2, cam.y - 40, STREET, VIEW.height + 80);
    ctx.fillStyle = PALETTE.roadLine;
    for (let j = 0; j <= ROWS; j += 1) {
      for (let x = roadX(0); x < CITY_W; x += 56) ctx.fillRect(x, roadY(j) - 2, 28, 4);
    }
    for (let i = 0; i <= COLS; i += 1) {
      for (let y = roadY(0); y < CITY_H; y += 56) ctx.fillRect(roadX(i) - 2, y, 4, 28);
    }
    // Traffic lights.
    for (const light of city.lights) {
      const ns = lightGreenNS(light, world.time);
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(light.x - 5, light.y - 5, 10, 10);
      ctx.fillStyle = ns ? '#4ade80' : '#ef4444';
      ctx.beginPath();
      ctx.arc(light.x, light.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Buildings: roof, sun-side shadow, and a name for the landmarks.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.height * 0.5, b.y + b.height * 0.5, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      if (b.landmark) {
        text(b.name, b.x + b.w / 2, b.y + b.h / 2 - 4, 13, 'rgba(255,255,255,0.85)', 'center');
        if (b.landmark === 'neon') {
          ctx.fillStyle = '#ff2e88';
          ctx.fillRect(b.x + 10, b.y + b.h - 22, b.w - 20, 6);
          ctx.fillStyle = '#22e6ff';
          ctx.fillRect(b.x + 10, b.y + b.h - 14, b.w - 20, 4);
        }
        if (b.landmark === 'police') text('PD', b.x + b.w / 2, b.y + b.h / 2 + 16, 16, '#9ecbff', 'center');
        if (b.landmark === 'hospital') text('\u271A', b.x + b.w / 2, b.y + b.h / 2 + 16, 16, '#ff8a8a', 'center');
        if (b.landmark === 'bank') text('$', b.x + b.w / 2, b.y + b.h / 2 + 16, 16, '#ffd319', 'center');
      }
    }
    // Trees.
    for (const tree of city.trees) {
      ctx.fillStyle = '#2c5d3a';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7a4d';
      ctx.beginPath();
      ctx.arc(tree.x - 2, tree.y - 2, tree.s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(ctx, car, flash) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22, -12, 44, 26);
    ctx.fillStyle = car.color;
    ctx.fillRect(-22, -11, 44, 22);
    ctx.fillStyle = 'rgba(20,28,40,0.85)';
    ctx.fillRect(-6, -9, 14, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(16, -9, 4, 18);
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(21, -9, 3, 5);
    ctx.fillRect(21, 4, 3, 5);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2e2e';
      ctx.fillRect(-24, -9, 3, 5);
      ctx.fillRect(-24, 4, 3, 5);
    }
    if (car.kind === 'police') {
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-4, -12, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 4);
    }
    if (car.hp < 55) {
      ctx.fillStyle = 'rgba(60,60,60,0.7)';
      ctx.beginPath();
      ctx.arc(-8 + Math.sin(car.id * 7) * 4, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ctx, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.75;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2f38';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(ctx, world) {
    const p = world.entities.player;
    if (p.dead || p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#1f6fb2';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2f38';
    ctx.fillRect(8, -2, 12, 4);
    ctx.fillStyle = PALETTE.player;
    ctx.fillRect(-13, -3, 5, 6);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
  }

  function drawMarker(ctx, world) {
    const m = world.missions;
    if (!m.active || m.done) return;
    const { x, y } = m.active;
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    const grad = ctx.createLinearGradient(x, y - 130, x, y);
    grad.addColorStop(0, 'rgba(255,211,25,0)');
    grad.addColorStop(1, 'rgba(255,211,25,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 14, y - 130, 28, 130);
    ctx.save();
    ctx.translate(x, y - 46 + Math.sin(world.time * 3) * 6);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.star;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,211,25,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 30 + Math.sin(world.time * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWorld(ctx, world) {
    const cam = camera(world);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawCity(ctx, world, cam);
    drawMarker(ctx, world);
    for (const pk of world.entities.pickups) {
      const bob = Math.sin(pk.bob) * 2;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-2.5, -7, 5, 14);
        ctx.fillRect(-7, -2.5, 14, 5);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#ffd319';
        ctx.fillRect(-8, -5, 16, 10);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', 0, 0);
      } else if (pk.kind === 'cash') {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14532d';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      } else {
        ctx.fillStyle = PALETTE.star;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
      }
      ctx.restore();
    }
    const flash = Math.sin(world.time * 10) > 0;
    for (const car of world.entities.cars) {
      if (car.kind === 'parked' || car.kind === 'traffic') drawCar(ctx, car, flash);
    }
    for (const car of world.entities.policeCars) drawCar(ctx, car, flash);
    const p = world.entities.player;
    if (p.car) drawCar(ctx, p.car, flash);
    for (const ped of world.entities.peds) drawPed(ctx, ped);
    for (const cop of world.entities.cops) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.rotate(cop.angle);
      ctx.fillStyle = '#2f6fed';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const g of world.entities.gang) {
      if (!g.alive) continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.fillStyle = '#8a2f2f';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2f38';
      ctx.fillRect(8, -2, 12, 4);
      ctx.restore();
      ctx.fillStyle = '#222';
      ctx.fillRect(g.x - 12, g.y - 20, 24, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(g.x - 12, g.y - 20, 24 * Math.max(0, g.hp / 50), 4);
    }
    ctx.fillStyle = '#ffd319';
    for (const b of world.entities.bullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    for (const pt of world.particles.list) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPlayer(ctx, world);
    ctx.restore();
    const light = daylight(world.clock);
    if (light) {
      ctx.fillStyle = `rgba(${light.color},${light.alpha})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      if (light.alpha > 0.2 && p.car) {
        const sx = p.car.x - cam.x;
        const sy = p.car.y - cam.y;
        const grad = ctx.createRadialGradient(sx, sy, 30, sx, sy, 260);
        grad.addColorStop(0, 'rgba(255,240,180,0.20)');
        grad.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      }
    }
  }

  function draw(world, screen, save) {
    const ctx = context;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawWorld(ctx, world);
      drawTitle(ctx, world, save);
    } else {
      drawWorld(ctx, world);
      if (screen === SCREEN_PLAY) drawHud(ctx, world);
      else if (screen === SCREEN_PAUSED) { drawHud(ctx, world); drawPaused(ctx); }
      else if (screen === SCREEN_HELP) { drawHud(ctx, world); drawHelp(ctx); }
      else if (screen === SCREEN_END) drawEnd(ctx, world.endKind, world);
    }
  }

  return { draw, resize };
}
