// VICE HARBOR — tuning, palette and story data in one place.
// Port Meridian is a 12 x 8 block grid city; every rule below reads from here.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };

// City geometry: blocks of BLOCK px separated by STREET px roads.
export const BLOCK = 200;
export const STREET = 72;
export const COLS = 12;
export const ROWS = 8;
export const CITY_W = COLS * BLOCK + (COLS + 1) * STREET;
export const CITY_H = ROWS * BLOCK + (ROWS + 1) * STREET;

export const PLAYER = {
  radius: 13,
  walk: 150,
  sprint: 235,
  hp: 100,
  punchRange: 34,
  punchDamage: 18,
  punchCooldown: 0.38,
};

export const PISTOL = { ammo: 12, maxAmmo: 48, damage: 34, range: 460, cooldown: 0.22, spread: 0.05 };

export const CAR = {
  accel: 420,
  brake: 620,
  reverse: 190,
  maxSpeed: 430,
  maxReverse: 160,
  turn: 2.6,
  grip: 3.2,
  radius: 20,
  hp: 100,
};

export const TRAFFIC = { count: 16, parked: 10, speed: 150, maxSpeed: 190 };
export const PEDS = { count: 26, walk: 42, flee: 150 };
export const POLICE = { maxCars: 6, maxCops: 6, chaseSpeed: 400, arrestRange: 30, sight: 560 };

export const WANTED = {
  decayDelay: 9, // seconds unseen before one star drops
  decayStep: 7,
  steal: 1,
  assault: 1,
  shoot: 1,
  killPed: 2,
  ramCop: 2,
  max: 5,
};

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    fixer: 'Marla Vane',
    brief: 'Rook, you need wheels and a name. Pick up the package at the docks, then drop it on Neon Row. No cops, no questions.',
    reward: 200,
    steps: [
      { type: 'goto', x: 6, y: 7.5, label: 'Pick up the package at Meridian Docks', radius: 46 },
      { type: 'goto', x: 10.5, y: 3.5, label: 'Deliver the package on Neon Row', radius: 46 },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    fixer: 'Marla Vane',
    brief: 'A client wants a Sunbeam GT, cherry red, parked by the plaza. Take it. The Yard pays top dollar — just don\'t let the blue lights catch you.',
    reward: 350,
    steps: [
      { type: 'steal', x: 6.5, y: 4.5, label: 'Steal the red Sunbeam GT by Civic Plaza', radius: 60 },
      { type: 'deliver', x: 1.5, y: 1.5, label: 'Deliver the Sunbeam to The Yard', radius: 52 },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    fixer: 'Marla Vane',
    brief: 'The Harbormen are watching the plaza. Grab the ledger on foot, then shake the heat and get to the safehouse. Run it clean.',
    reward: 500,
    steps: [
      { type: 'pickup', x: 6.5, y: 4.5, label: 'Grab the ledger at Civic Plaza (on foot)', radius: 44, onFoot: true },
      { type: 'escape', x: 1.5, y: 6.5, label: 'Lose the cops, then reach the Safehouse', radius: 52, wanted: 2 },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    fixer: 'Deke Arroyo',
    brief: 'The Harbormen torched my garage. Three of them are holed up at Warehouse Row. Go settle it — and make sure they stay down.',
    reward: 700,
    steps: [
      { type: 'eliminate', x: 9.5, y: 1.5, label: 'Take out the 3 Harbormen at Warehouse Row', radius: 260, count: 3 },
      { type: 'goto', x: 1.5, y: 6.5, label: 'Get back to the Safehouse', radius: 52 },
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    fixer: 'Marla Vane',
    brief: 'One job and we\'re out. Pick up the crew on Neon Row, hit the Bank of Meridian, and run for the harbor boat. The whole city will be on you. Make it count.',
    reward: 1500,
    steps: [
      { type: 'goto', x: 10.5, y: 3.5, label: 'Pick up the crew on Neon Row', radius: 52 },
      { type: 'goto', x: 8.5, y: 4.5, label: 'Reach the Bank of Meridian', radius: 52 },
      { type: 'hold', x: 8.5, y: 4.5, label: 'Grab the cash — hold position', radius: 52, hold: 3 },
      { type: 'escape', x: 6.5, y: 8.4, label: 'Escape to the harbor boat', radius: 56, wanted: 4 },
    ],
  },
];

export const PALETTE = {
  sky: '#0e1420',
  grass: '#2c5d3a',
  park: '#356b42',
  sidewalk: '#8d8578',
  road: '#33373f',
  roadLine: '#c9b458',
  building: ['#7a5c4e', '#5e6b7a', '#8a6f4d', '#6b5a7d', '#4e6b5a', '#7d5a6b', '#5a6b7a', '#8a7a4d'],
  roof: ['#4a3a32', '#3a4550', '#57493a', '#453a52', '#33443a', '#523a48', '#3a4550', '#574a33'],
  neon: ['#ff2e88', '#22e6ff', '#ffd319', '#7cff4d', '#ff7b00'],
  water: '#1d4e6b',
  sand: '#b8a06a',
  player: '#ffd319',
  playerCar: '#e5484d',
  police: '#2f6fed',
  policeLight: '#ff2e2e',
  gang: '#8a2f2f',
  ped: ['#d8c9a3', '#a3b8d8', '#d8a3a3', '#a3d8b8', '#c9a3d8'],
  text: '#f2ede4',
  muted: '#9a938a',
  panel: 'rgba(12,16,24,0.82)',
  star: '#ffd319',
  health: '#4ade80',
  damage: '#ef4444',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'vice-harbor.save.v1';
export const GAME_NAME = 'VICE HARBOR';
export const CITY_NAME = 'Port Meridian';
