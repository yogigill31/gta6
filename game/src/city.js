// Port Meridian: a seeded grid city. Streets run on the grid lines; blocks hold
// buildings, parks or one named landmark each. Traffic lights sit at the busier
// intersections and cycle with a phase offset, so the city never feels frozen.
import { BLOCK, CITY_H, CITY_W, COLS, PALETTE, ROWS, STREET } from './config.js';
import { pick, randInt } from './random.js';

/** Pixel centre of vertical road i (0..COLS) and horizontal road j (0..ROWS). */
export function roadX(i) { return STREET / 2 + i * (BLOCK + STREET); }
export function roadY(j) { return STREET / 2 + j * (BLOCK + STREET); }
/** Pixel bounds of block (i, j). */
export function blockRect(i, j) {
  return {
    x: STREET + i * (BLOCK + STREET),
    y: STREET + j * (BLOCK + STREET),
    w: BLOCK,
    h: BLOCK,
  };
}

/** Named places the story and the missions point at, as block coordinates. */
export const LANDMARKS = {
  docks: { i: 6, j: 7, name: 'Meridian Docks', kind: 'docks' },
  neon: { i: 10, j: 3, name: 'Neon Row', kind: 'neon' },
  plaza: { i: 6, j: 4, name: 'Civic Plaza', kind: 'park' },
  yard: { i: 1, j: 1, name: 'The Yard', kind: 'yard' },
  safehouse: { i: 1, j: 6, name: 'Safehouse', kind: 'safehouse' },
  bank: { i: 8, j: 4, name: 'Bank of Meridian', kind: 'bank' },
  warehouse: { i: 9, j: 1, name: 'Warehouse Row', kind: 'warehouse' },
  police: { i: 6, j: 2, name: 'Meridian PD', kind: 'police' },
  hospital: { i: 3, j: 5, name: 'St. Anselm Hospital', kind: 'hospital' },
  harbor: { i: 6, j: 8, name: 'Harbor Boat', kind: 'boat' },
};

/** World point at the middle of a block, with an optional fractional offset. */
export function landmarkPoint(key, fx = 0.5, fy = 0.5) {
  const mark = LANDMARKS[key];
  if (!mark) return { x: CITY_W / 2, y: CITY_H / 2 };
  if (mark.j >= ROWS) return { x: roadX(mark.i) + (fx - 0.5) * 60, y: CITY_H + 40 };
  const r = blockRect(mark.i, mark.j);
  return { x: r.x + r.w * fx, y: r.y + r.h * fy };
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lights = [];
  const landmarkByBlock = new Map();
  for (const key of Object.keys(LANDMARKS)) {
    const mark = LANDMARKS[key];
    landmarkByBlock.set(`${mark.i},${mark.j}`, { ...mark, key });
  }

  for (let j = 0; j < ROWS; j += 1) {
    for (let i = 0; i < COLS; i += 1) {
      const mark = landmarkByBlock.get(`${i},${j}`);
      const r = blockRect(i, j);
      if (mark && (mark.kind === 'park' || mark.kind === 'docks')) {
        parks.push({ ...r, kind: mark.kind, name: mark.name });
        const count = mark.kind === 'park' ? 9 : 4;
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: r.x + 20 + random() * (r.w - 40), y: r.y + 20 + random() * (r.h - 40), s: 7 + random() * 6 });
        }
        continue;
      }
      if (mark) {
        const color = pick(random, PALETTE.building);
        const roof = pick(random, PALETTE.roof);
        buildings.push({
          x: r.x + 16, y: r.y + 16, w: r.w - 32, h: r.h - 32,
          color, roof, landmark: mark.key, name: mark.name, height: 18 + random() * 22,
        });
        continue;
      }
      if (random() < 0.16) {
        parks.push({ ...r, kind: 'park', name: '' });
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: r.x + 16 + random() * (r.w - 32), y: r.y + 16 + random() * (r.h - 32), s: 6 + random() * 7 });
        }
        continue;
      }
      const split = random() < 0.5;
      const color = pick(random, PALETTE.building);
      const roof = pick(random, PALETTE.roof);
      if (split) {
        buildings.push({ x: r.x + 12, y: r.y + 12, w: r.w / 2 - 18, h: r.h - 24, color, roof, height: 10 + random() * 26 });
        buildings.push({ x: r.x + r.w / 2 + 6, y: r.y + 12, w: r.w / 2 - 18, h: r.h - 24, color: pick(random, PALETTE.building), roof, height: 10 + random() * 26 });
      } else {
        buildings.push({ x: r.x + 14, y: r.y + 14, w: r.w - 28, h: r.h - 28, color, roof, height: 12 + random() * 30 });
      }
    }
  }

  // Traffic lights at the interior intersections where two busy roads cross.
  for (let j = 1; j < ROWS; j += 1) {
    for (let i = 1; i < COLS; i += 1) {
      if ((i + j) % 2 === 0) continue;
      lights.push({ i, j, x: roadX(i), y: roadY(j), phase: randInt(random, 0, 10) });
    }
  }

  return {
    width: CITY_W,
    height: CITY_H,
    buildings,
    parks,
    trees,
    lights,
    /** The harbour water band along the south edge, with moored boats. */
    water: { y: CITY_H + 8, height: 120 },
    boats: [
      { x: roadX(4), y: CITY_H + 52, angle: 0.1, color: '#d8d3c3' },
      { x: roadX(8), y: CITY_H + 64, angle: -0.12, color: '#7fb3d8' },
    ],
  };
}

/** True when the circle at (x, y) with radius r overlaps any solid building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** Push a circle out of every building it overlaps; returns true when it was pushed. */
export function resolveBuildings(city, body, r) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    let dx = body.x - cx;
    let dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    pushed = true;
    if (d2 < 0.01) {
      // Dead centre: shove out along the smallest overlap axis.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
      continue;
    }
    const d = Math.sqrt(d2);
    dx /= d;
    dy /= d;
    body.x = cx + dx * r;
    body.y = cy + dy * r;
  }
  return pushed;
}

/** Green for north-south traffic when true, east-west when false, at sim time t. */
export function lightGreenNS(light, t) {
  const cycle = (t + light.phase) % 10;
  return cycle < 4.5;
}

/** Nearest light to a point, or null when none is close. */
export function nearestLight(city, x, y, maxDist = 130) {
  let best = null;
  let bestD = maxDist;
  for (const light of city.lights) {
    const d = Math.hypot(light.x - x, light.y - y);
    if (d < bestD) {
      bestD = d;
      best = light;
    }
  }
  return best;
}
