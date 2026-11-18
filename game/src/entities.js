// The actors: the player, cars (traffic, parked, police, the player's), pedestrians,
// foot cops, gang members and pickups. Spawning is seeded, so the same seed deals the
// same streets.
import { CAR, CITY_H, CITY_W, PALETTE, PEDS, PISTOL, PLAYER, TRAFFIC } from './config.js';
import { landmarkPoint, roadX, roadY } from './city.js';
import { pick, randInt } from './random.js';

const CAR_COLORS = ['#c9c9c9', '#3a6ea5', '#c98a3a', '#5a7a4a', '#8a5a7a', '#d8d3c3', '#4a4a55', '#a5433a'];
const CAR_MODELS = ['Sedan', 'Coupe', 'Van', 'Hatch', 'Pickup', 'Taxi'];

/** A car body: position, heading, speed and who drives it. */
export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle,
    speed: opts.speed ?? 0,
    color: opts.color ?? pick(opts.random ?? Math.random, CAR_COLORS),
    model: opts.model ?? 'Sedan',
    kind: opts.kind ?? 'traffic', // traffic | parked | police | player
    hp: opts.hp ?? CAR.hp,
    driver: opts.driver ?? true,
    wanted: false,
    brakeLight: false,
    smoke: 0,
    id: opts.id ?? 0,
  };
}

export function makePed(x, y, random) {
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: 0,
    color: pick(random, PALETTE.ped),
    state: 'walk', // walk | flee | down
    tx: x, ty: y, // walk target
    wait: random() * 2,
    panic: 0,
  };
}

export function makeCop(x, y) {
  return { x, y, angle: 0, speed: 0, state: 'chase', stamina: 6 };
}

export function makeGang(x, y, random) {
  return {
    x, y,
    angle: random() * Math.PI * 2,
    hp: 50,
    cooldown: 1 + random(),
    alive: true,
    strafe: random() < 0.5 ? 1 : -1,
  };
}

export function makePickup(x, y, kind) {
  return { x, y, kind, bob: 0 }; // health | ammo | cash
}

/** All the actors of one fresh game, laid out from the seed. */
export function createEntities(world) {
  const { random, city } = world;
  // Rook starts on the road south of the Safehouse, beside his tired sedan.
  const start = { x: roadX(1), y: roadY(7) };
  const player = {
    x: start.x,
    y: start.y,
    angle: -Math.PI / 2,
    speed: 0,
    hp: PLAYER.hp,
    cash: world.save.cash,
    ammo: PISTOL.ammo,
    car: null,
    wanted: 0,
    heat: 0,
    unseen: 0,
    punchCd: 0,
    shootCd: 0,
    hurtCd: 0,
    dead: false,
    deadKind: null,
  };

  const cars = [];
  let id = 1;
  // Parked cars along the roads, some near the safehouse for the opening.
  for (let i = 0; i < TRAFFIC.parked; i += 1) {
    const vertical = random() < 0.5;
    const road = vertical ? randInt(random, 1, 12) : randInt(random, 1, 8);
    const along = randInt(random, 1, vertical ? 8 : 12);
    const x = vertical ? roadX(road) + (random() < 0.5 ? -24 : 24) : roadX(along) + (random() - 0.5) * 40;
    const y = vertical ? roadY(along) + (random() - 0.5) * 40 : roadY(road) + (random() < 0.5 ? -24 : 24);
    cars.push(makeCar(x, y, vertical ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), {
      kind: 'parked', driver: false, color: pick(random, CAR_COLORS), model: pick(random, CAR_MODELS), random, id: id++,
    }));
  }
  // The mission-2 target: a cherry-red Sunbeam GT by Civic Plaza.
  const gt = landmarkPoint('plaza', 0.5, 1.15);
  cars.push(makeCar(gt.x, gt.y, Math.PI / 2, {
    kind: 'parked', driver: false, color: '#d21f2b', model: 'Sunbeam GT', random, id: id++,
  }));
  // The player's own starter car, a tired sedan by the safehouse. It is 'parked'
  // until the player gets in; only the car being driven carries kind 'player'.
  const mine = makeCar(start.x + 64, start.y, 0, {
    kind: 'parked', driver: false, color: '#e5484d', model: 'Meridian', random, id: id++,
  });
  cars.push(mine);

  // Moving traffic, spread over the roads.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const vertical = random() < 0.5;
    const road = vertical ? randInt(random, 0, 13) : randInt(random, 0, 9);
    const pos = random();
    const x = vertical ? roadX(road) + (random() < 0.5 ? -17 : 17) : roadX(0) + pos * CITY_W;
    const y = vertical ? roadY(0) + pos * CITY_H : roadY(road) + (random() < 0.5 ? -17 : 17);
    const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    cars.push(makeCar(x, y, angle, {
      kind: 'traffic', speed: TRAFFIC.speed * (0.8 + random() * 0.4),
      color: pick(random, CAR_COLORS), model: pick(random, CAR_MODELS), random, id: id++,
    }));
  }

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const x = 80 + random() * (CITY_W - 160);
    const y = 80 + random() * (CITY_H - 160);
    peds.push(makePed(x, y, random));
  }

  return {
    player,
    cars,
    peds,
    cops: [],
    policeCars: [],
    gang: [],
    bullets: [],
    pickups: [
      makePickup(landmarkPoint('hospital', 0.5, 0.5).x, landmarkPoint('hospital', 0.5, 0.5).y, 'health'),
      makePickup(landmarkPoint('plaza', 0.2, 0.2).x, landmarkPoint('plaza', 0.2, 0.2).y, 'ammo'),
      makePickup(landmarkPoint('neon', 0.3, 0.7).x, landmarkPoint('neon', 0.3, 0.7).y, 'cash'),
    ],
    nextCarId: id,
  };
}

/** A fresh police car entering from the city edge, aimed at the player. */
export function spawnPoliceCar(world, near) {
  const { random, city } = world;
  const edge = randInt(random, 0, 4);
  let x;
  let y;
  if (edge === 0) { x = near.x + (random() - 0.5) * 300; y = 60; }
  else if (edge === 1) { x = near.x + (random() - 0.5) * 300; y = city.height - 60; }
  else if (edge === 2) { x = 60; y = near.y + (random() - 0.5) * 300; }
  else { x = city.width - 60; y = near.y + (random() - 0.5) * 300; }
  x = Math.max(40, Math.min(city.width - 40, x));
  y = Math.max(40, Math.min(city.height - 40, y));
  const car = makeCar(x, y, Math.atan2(near.y - y, near.x - x), {
    kind: 'police', color: PALETTE.police, model: 'Interceptor', random, id: world.entities.nextCarId++,
  });
  world.entities.policeCars.push(car);
  return car;
}

/** A foot cop stepping out near the player. */
export function spawnCop(world, near) {
  const { random } = world;
  const a = random() * Math.PI * 2;
  const d = 260 + random() * 140;
  const cop = makeCop(
    Math.max(30, Math.min(world.city.width - 30, near.x + Math.cos(a) * d)),
    Math.max(30, Math.min(world.city.height - 30, near.y + Math.sin(a) * d)),
  );
  world.entities.cops.push(cop);
  return cop;
}
