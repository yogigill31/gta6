// The HUD and the menus: health, cash, wanted stars, ammo, mission objective, clock,
// message feed, centre banners — and the live minimap in the corner, drawn from the
// same world the game simulates. The title, pause, help, busted and wasted screens
// live here too.
import { CITY_NAME, FONT, GAME_NAME, MISSIONS, PALETTE, VIEW } from './config.js';
import { currentMission, currentStep } from './missions.js';

const MINI = { w: 208, h: 148, x: VIEW.width - 224, y: VIEW.height - 164 };

export function drawHud(ctx, world) {
  const p = world.entities.player;
  const m = world.missions;
  ctx.save();
  // Top-left: health bar + cash.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(14, 14, 240, 58);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 24, 220, 12);
  ctx.fillStyle = p.hp > 50 ? PALETTE.health : p.hp > 25 ? '#facc15' : PALETTE.damage;
  ctx.fillRect(24, 24, 220 * Math.max(0, p.hp / 100), 12);
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 24, 52);
  ctx.fillStyle = '#4ade80';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 130, 53);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(p.car ? `${p.car.model}  ·  E exit` : 'On foot  ·  E enter car', 24, 66);

  // Top-right: wanted stars + clock + ammo.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(VIEW.width - 254, 14, 240, 58);
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? PALETTE.star : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', VIEW.width - 244 + i * 26, 40);
  }
  const h = Math.floor(world.clock) % 24;
  const min = Math.floor((world.clock % 1) * 60);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, VIEW.width - 24, 34);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(p.car ? 'RAMMING' : `PISTOL  ${p.ammo} / 48`, VIEW.width - 24, 56);

  // Top-centre: current mission objective.
  const mission = currentMission(m);
  const step = currentStep(m);
  if (mission && step) {
    const label = `${mission.title} — ${step.label}`;
    ctx.font = `bold 15px ${FONT}`;
    const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect((VIEW.width - w) / 2, 14, w, 34);
    ctx.fillStyle = PALETTE.star;
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.width / 2, 37);
    // Distance to the marker.
    if (m.active) {
      const px = p.car ? p.car.x : p.x;
      const py = p.car ? p.car.y : p.y;
      const d = Math.round(Math.hypot(m.active.x - px, m.active.y - py));
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `12px ${FONT}`;
      ctx.fillText(`${d}m`, VIEW.width / 2, 62);
    }
  } else if (m.done) {
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = PALETTE.panel;
    const label = 'Story complete — free roam Port Meridian';
    const w = ctx.measureText(label).width + 28;
    ctx.fillRect((VIEW.width - w) / 2, 14, w, 34);
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.width / 2, 37);
  }

  // Message feed, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = `14px ${FONT}`;
  let y = VIEW.height - 24;
  for (let i = world.messages.length - 1; i >= 0; i -= 1) {
    const msg = world.messages[i];
    ctx.globalAlpha = Math.min(1, msg.t / 1.5);
    ctx.fillStyle = msg.color;
    ctx.fillText(msg.text, 16, y);
    y -= 20;
  }
  ctx.globalAlpha = 1;

  // Centre banner (mission passed / new job / busted).
  if (world.banner && world.banner.t > 0) {
    const a = Math.min(1, world.banner.t);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, VIEW.height / 2 - 64, VIEW.width, 96);
    ctx.fillStyle = PALETTE.star;
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(world.banner.title, VIEW.width / 2, VIEW.height / 2 - 14);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(world.banner.sub, VIEW.width / 2, VIEW.height / 2 + 18);
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, world);
  ctx.restore();
}

function drawMinimap(ctx, world) {
  const { city } = world;
  const scaleX = MINI.w / city.width;
  const scaleY = MINI.h / city.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.fillRect(MINI.x - 6, MINI.y - 6, MINI.w + 12, MINI.h + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(MINI.x - 6, MINI.y - 6, MINI.w + 12, MINI.h + 12);
  // Roads.
  ctx.fillStyle = '#4a4f58';
  const roadW = Math.max(2, 72 * scaleX);
  for (let i = 0; i <= 12; i += 1) {
    const x = MINI.x + (72 / 2 + i * 272) * scaleX;
    ctx.fillRect(x - roadW / 2, MINI.y, roadW, MINI.h);
  }
  for (let j = 0; j <= 8; j += 1) {
    const y = MINI.y + (72 / 2 + j * 272) * scaleY;
    ctx.fillRect(MINI.x, y - roadW / 2, MINI.w, roadW);
  }
  const px = (x) => MINI.x + x * scaleX;
  const py = (y) => MINI.y + y * scaleY;
  // Mission marker: a pulsing yellow star.
  const m = world.missions;
  if (m.active && !m.done) {
    const pulse = 3 + Math.sin(world.time * 5) * 1.5;
    ctx.fillStyle = PALETTE.star;
    ctx.beginPath();
    ctx.arc(px(m.active.x), py(m.active.y), pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', px(m.active.x), py(m.active.y));
  }
  // Cars: traffic yellow, police flashing blue.
  for (const car of world.entities.cars) {
    if (car.kind !== 'traffic') continue;
    ctx.fillStyle = '#ffd319';
    ctx.fillRect(px(car.x) - 1.5, py(car.y) - 1.5, 3, 3);
  }
  const flash = Math.sin(world.time * 10) > 0;
  ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
  for (const car of world.entities.policeCars) {
    ctx.beginPath();
    ctx.arc(px(car.x), py(car.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow, pointing along the heading.
  const p = world.entities.player;
  const cx = p.car ? p.car.x : p.x;
  const cy = p.car ? p.car.y : p.y;
  const a = p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(px(cx), py(cy));
  ctx.rotate(a);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North arrow.
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N ↑', MINI.x + 2, MINI.y - 10);
  ctx.restore();
}

export function drawTitle(ctx, world, save) {
  ctx.save();
  // Dark only behind the text band, so the city shows through at the edges.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, 'rgba(8,10,16,0.16)');
  grad.addColorStop(0.28, 'rgba(8,10,16,0.52)');
  grad.addColorStop(0.68, 'rgba(8,10,16,0.52)');
  grad.addColorStop(1, 'rgba(8,10,16,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.star;
  ctx.font = `bold 84px ${FONT}`;
  ctx.fillText(GAME_NAME, VIEW.width / 2, 210);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `26px ${FONT}`;
  ctx.fillText(`— ${CITY_NAME} —`, VIEW.width / 2, 252);
  ctx.fillStyle = '#ffb347';
  ctx.font = `17px ${FONT}`;
  ctx.fillText('Five jobs. One city. No rules but yours.', VIEW.width / 2, 288);
  const blink = Math.sin(world.time * 3) > -0.2;
  ctx.fillStyle = blink ? PALETTE.text : 'rgba(255,255,255,0.35)';
  ctx.font = `bold 22px ${FONT}`;
  const hasProgress = save && (save.missionsDone > 0 || save.cash > 0 || save.storyDone);
  ctx.fillText(hasProgress ? 'ENTER — Continue  ·  N — New Game' : 'ENTER — New Game', VIEW.width / 2, 360);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `15px ${FONT}`;
  ctx.fillText('WASD drive / walk   ·   E enter & steal cars   ·   SPACE shoot   ·   F punch   ·   SHIFT sprint / boost', VIEW.width / 2, 420);
  ctx.fillText('P pause   ·   H help   ·   M mute   ·   Progress saves automatically', VIEW.width / 2, 446);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('An original game. Port Meridian, Rook Calloway and Marla Vane are invented here — nothing from any commercial game.', VIEW.width / 2, 690);
  ctx.restore();
}

export function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `17px ${FONT}`;
  ctx.fillText('P / Esc — resume      H — help      M — mute', VIEW.width / 2, VIEW.height / 2 + 30);
  ctx.restore();
}

export function drawHelp(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.88)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.star;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText('HOW TO PLAY', 340, 110);
  const lines = [
    ['Move / drive', 'WASD or arrow keys. In a car: W accelerates, S brakes, A/D steer, SPACE handbrake.'],
    ['Enter / steal a car', 'Walk up to any car and press E. Stealing in front of the law raises your wanted level.'],
    ['Fight', 'SPACE fires the pistol (on foot). F throws a punch. R reloads. Ammo and health pickups are around the city.'],
    ['Wanted level', 'Stars rise when you steal, shoot or hurt people. Police cars chase; foot cops arrest. Stay out of sight to cool off.'],
    ['Missions', 'Follow the yellow ! on the minimap. Finish all five jobs for Marla Vane to complete the story.'],
    ['Save', 'Cash and mission progress save automatically. Continue from the title screen picks up where you left off.'],
    ['Keys', 'P pause · H help · M mute · Shift sprint / boost'],
  ];
  ctx.font = `16px ${FONT}`;
  let y = 160;
  for (const [head, body] of lines) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(head, 340, y);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(body, 340, y + 22);
    y += 52;
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('H or Esc — back to the game', VIEW.width / 2, 600);
  ctx.restore();
}

export function drawEnd(ctx, kind, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
  const sub = kind === 'busted'
    ? 'The Meridian PD hauled you in. You lost $100 in fines — and the heat is off.'
    : 'You got taken out on the streets of Port Meridian. The city keeps moving without you.';
  ctx.fillStyle = kind === 'busted' ? '#3b82f6' : PALETTE.damage;
  ctx.font = `bold 72px ${FONT}`;
  ctx.fillText(title, VIEW.width / 2, 300);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `19px ${FONT}`;
  ctx.fillText(sub, VIEW.width / 2, 350);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `16px ${FONT}`;
  ctx.fillText(`Cash $${world.entities.player.cash.toLocaleString('en-US')}  ·  Missions done ${world.save.missionsDone} / ${MISSIONS.length}`, VIEW.width / 2, 400);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText('ENTER — back on the streets', VIEW.width / 2, 470);
  ctx.restore();
}
