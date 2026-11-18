// Traffic and pedestrians. Traffic cars keep to their lane on the road grid, stop
// at red lights and slow for the car ahead; at an intersection they mostly go straight
// and sometimes turn. Pedestrians stroll the sidewalks and run from gunfire and chases.
import { BLOCK, CITY_H, CITY_W, COLS, PEDS, ROWS, STREET, TRAFFIC } from './config.js';
import { lightGreenNS, nearestLight, resolveBuildings, roadX, roadY } from './city.js';

const LANE = 17; // offset from the road centre: right-hand driving
const STOP_DIST = 46;
const FOLLOW_DIST = 58;

/** Nearest road index (vertical) or (horizontal) to a point. */
function nearestRoadV(x) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= COLS; i += 1) {
    const d = Math.abs(roadX(i) - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
function nearestRoadH(y) {
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j <= ROWS; j += 1) {
    const d = Math.abs(roadY(j) - y);
    if (d < bestD) { bestD = d; best = j; }
  }
  return best;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function carAhead(world, car) {
  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  let best = Infinity;
  for (const other of world.entities.cars) {
    if (other === car || other.kind === 'parked') continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const along = ox * dx + oy * dy;
    if (along < 4 || along > FOLLOW_DIST + 40) continue;
    const side = Math.abs(ox * -dy + oy * dx);
    if (side < 26 && along < best) best = along;
  }
  // The player counts as a car ahead too when they are driving.
  const p = world.entities.player;
  if (p.car) {
    const ox = p.car.x - car.x;
    const oy = p.car.y - car.y;
    const along = ox * dx + oy * dy;
    const side = Math.abs(ox * -dy + oy * dx);
    if (along > 4 && along < FOLLOW_DIST + 40 && side < 26 && along < best) best = along;
  }
  return best;
}

function lightAhead(world, car) {
  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  const light = nearestLight(world.city, car.x + dx * 60, car.y + dy * 60, 70);
  if (!light) return false;
  const ns = lightGreenNS(light, world.time);
  const movingNS = Math.abs(dy) > Math.abs(dx);
  return movingNS !== ns; // red for this direction
}

function stepTrafficCar(world, car, dt) {
  const { random } = world;
  // Heading: snap gently to the nearest cardinal direction so cars stay on roads.
  const target = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
  car.angle = angleLerp(car.angle, target, Math.min(1, 6 * dt));

  let want = TRAFFIC.maxSpeed * (0.85 + ((car.id * 37) % 10) / 50);
  if (carAhead(world, car) < FOLLOW_DIST) want = Math.min(want, 40);
  if (lightAhead(world, car)) want = 0;
  car.speed += Math.max(-420 * dt, Math.min(160 * dt, want - car.speed));

  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  car.x += dx * car.speed * dt;
  car.y += dy * car.speed * dt;
  car.brakeLight = want === 0 && car.speed > 4;

  // At an intersection, sometimes turn onto the crossing road.
  const nearV = Math.abs(car.x - roadX(nearestRoadV(car.x))) < 6;
  const nearH = Math.abs(car.y - roadY(nearestRoadH(car.y))) < 6;
  if (nearV && nearH && car.speed > 30 && random() < dt * 0.35) {
    const vertical = Math.abs(dy) > Math.abs(dx);
    const turnLeft = random() < 0.5;
    if (vertical) car.angle = turnLeft ? Math.PI : 0;
    else car.angle = turnLeft ? -Math.PI / 2 : Math.PI / 2;
  }

  // Wrap around the city edge: a car that leaves re-enters from the other side.
  if (car.x < -30) car.x = CITY_W + 20;
  else if (car.x > CITY_W + 30) car.x = -20;
  if (car.y < -30) car.y = CITY_H + 20;
  else if (car.y > CITY_H + 30) car.y = -20;
}

export function stepTraffic(world, dt) {
  for (const car of world.entities.cars) {
    if (car.kind === 'traffic') stepTrafficCar(world, car, dt);
  }
}

/** A sidewalk point near (x, y): offset from the nearest road by the sidewalk width. */
function sidewalkTarget(world, ped) {
  const { random } = world;
  const vi = nearestRoadV(ped.x);
  const hj = nearestRoadH(ped.y);
  const useV = random() < 0.5;
  if (useV) {
    const x = roadX(vi) + (random() < 0.5 ? -1 : 1) * (STREET / 2 + 8);
    const y = ped.y + (random() - 0.5) * 300;
    return { x: Math.max(40, Math.min(CITY_W - 40, x)), y: Math.max(40, Math.min(CITY_H - 40, y)) };
  }
  const x = ped.x + (random() - 0.5) * 300;
  const y = roadY(hj) + (random() < 0.5 ? -1 : 1) * (STREET / 2 + 8);
  return { x: Math.max(40, Math.min(CITY_W - 40, x)), y: Math.max(40, Math.min(CITY_H - 40, y)) };
}

function stepPed(world, ped, dt) {
  const { random } = world;
  if (ped.state === 'down') return;
  // Flee: run away from the nearest threat.
  let threat = null;
  let threatD = 170;
  const p = world.entities.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const pd = Math.hypot(px - ped.x, py - ped.y);
  if (p.wanted > 0 && pd < threatD) { threat = { x: px, y: py }; threatD = pd; }
  for (const cop of world.entities.cops) {
    const d = Math.hypot(cop.x - ped.x, cop.y - ped.y);
    if (d < threatD) { threat = cop; threatD = d; }
  }
  if (world.alarm > 0) {
    const d = Math.hypot(world.alarmX - ped.x, world.alarmY - ped.y);
    if (d < 240) { threat = { x: world.alarmX, y: world.alarmY }; threatD = d; }
  }
  if (threat) {
    ped.state = 'flee';
    ped.panic = 2.5;
    const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    ped.tx = ped.x + Math.cos(a) * 220;
    ped.ty = ped.y + Math.sin(a) * 220;
  } else if (ped.panic > 0) {
    ped.panic -= dt;
    if (ped.panic <= 0) ped.state = 'walk';
  }

  const speed = ped.state === 'flee' ? PEDS.flee : PEDS.walk;
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    ped.wait -= dt;
    if (ped.wait <= 0) {
      const t = sidewalkTarget(world, ped);
      ped.tx = t.x;
      ped.ty = t.y;
      ped.wait = 1 + random() * 3;
    }
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / d) * speed * dt;
  ped.y += (dy / d) * speed * dt;
  resolveBuildings(world.city, ped, 10);
  ped.x = Math.max(24, Math.min(CITY_W - 24, ped.x));
  ped.y = Math.max(24, Math.min(CITY_H - 24, ped.y));
}

export function stepPeds(world, dt) {
  for (const ped of world.entities.peds) stepPed(world, ped, dt);
}
