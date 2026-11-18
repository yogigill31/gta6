// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, help and end
// (busted / wasted). Progress saves automatically; Continue resumes it.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
// ?test=core runs the self-checks and sets window.__testResult.
import { PISTOL, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, startStory } from './world.js';
import { createAudio, playSound, setMuted, stepAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_END, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, freshSave, readSave, writeSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const test = params.get('test');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
// ?fresh=1 wipes the save before the title draws (so the cover shows New Game).
if (params.get('fresh')) clearSave();

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const hooks = {
  sfx: (name) => playSound(audio, name),
  persist: (save) => writeSave(save),
};
let saveData = readSave() ?? freshSave();
let world = createWorld(createRandom(seed), saveData, hooks);
const renderer = createRenderer(canvas);

// The handle the playtest driver reads: live state and a deterministic digest.
window.__viceharbor = {
  world,
  version: 'vice-harbor-1',
  get screen() { return screen; },
  digest() {
    const p = world.entities.player;
    const round2 = (v) => Math.round(v * 100) / 100;
    return JSON.stringify({
      time: round2(world.time),
      clock: round2(world.clock),
      player: [round2(p.x), round2(p.y), round2(p.angle), p.hp, p.cash, p.ammo, p.wanted, p.car ? p.car.model : null],
      mission: [world.missions.index, world.missions.step, world.missions.done],
      traffic: world.entities.cars.filter((c) => c.kind === 'traffic').slice(0, 6).map((c) => [round2(c.x), round2(c.y), round2(c.angle)]),
      police: world.entities.policeCars.length,
      cops: world.entities.cops.length,
      peds: world.entities.peds.filter((d) => d.state !== 'down').length,
      gang: world.entities.gang.filter((g) => g.alive).length,
    });
  },
};

let screen = SCREEN_TITLE;

function announce(message) {
  status.textContent = message;
}

function newGame() {
  clearSave();
  saveData = freshSave();
  world = createWorld(createRandom(seed), saveData, hooks);
  window.__viceharbor.world = world;
  startStory(world);
  screen = SCREEN_PLAY;
  announce('Playing. Follow the yellow marker.');
}

function continueGame() {
  world = createWorld(createRandom(seed), saveData, hooks);
  window.__viceharbor.world = world;
  startStory(world);
  screen = SCREEN_PLAY;
  announce('Playing. Follow the yellow marker.');
}

function runShot(name) {
  const scene = stageShot(name, world);
  screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world, screen, saveData);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runTests() {
  const checks = {};
  const fail = (name, ok) => { checks[name] = !!ok; };
  // 1. The city generated.
  fail('cityBuildings', world.city.buildings.length > 50);
  fail('cityLights', world.city.lights.length > 0);
  fail('cityParks', world.city.parks.length > 0);
  // 2. The player starts on foot with the save's cash.
  fail('playerOnFoot', world.entities.player.car === null);
  fail('saveCash', world.entities.player.cash === saveData.cash);
  // 3. Enter the starter car and drive.
  const car = world.entities.cars.find((c) => c.model === 'Meridian');
  const p = world.entities.player;
  p.x = car.x + 30;
  p.y = car.y;
  world.enterExitCar();
  fail('enterCar', p.car === car);
  const x0 = car.x;
  const y0 = car.y;
  const fake = { move: () => ({ x: 0, y: -1 }), shootHeld: () => false, sprintHeld: () => false };
  for (let i = 0; i < 120; i += 1) world.step(fake, 0, STEP);
  fail('carDrives', Math.hypot(car.x - x0, car.y - y0) > 60 || car.speed > 20);
  world.enterExitCar();
  fail('exitCar', p.car === null);
  // 4. Stealing a traffic car raises the wanted level.
  const traffic = world.entities.cars.find((c) => c.kind === 'traffic');
  p.x = traffic.x + 30;
  p.y = traffic.y;
  p.wanted = 0;
  p.heat = 0;
  world.enterExitCar();
  fail('stealWanted', p.wanted >= 1);
  world.enterExitCar();
  // 5. Police spawn at wanted 3. The player stays in a car for this one: foot
  // cops cannot arrest a driver, so the chase can build without a bust ending it.
  world.enterExitCar();
  fail('backInCar', p.car !== null);
  p.wanted = 3;
  p.heat = 60;
  for (let i = 0; i < 600; i += 1) world.step(fake, 0, STEP);
  fail('policeSpawn', world.entities.policeCars.length > 0 || world.entities.cops.length > 0);
  // 6. Mission 1 advances when the player reaches its marker.
  world.enterExitCar();
  p.wanted = 0;
  p.heat = 0;
  world.entities.policeCars.length = 0;
  world.entities.cops.length = 0;
  startStory(world);
  const step0 = world.missions.active;
  fail('missionActive', !!step0);
  p.x = step0.x;
  p.y = step0.y;
  if (p.car) world.enterExitCar();
  world.step(fake, 0, STEP);
  fail('missionAdvances', world.missions.step === 1 || world.missions.index === 1);
  // 7. The pistol fires and spends ammo.
  const ammo0 = p.ammo;
  const input = { move: () => ({ x: 0, y: 0 }), shootHeld: () => true, sprintHeld: () => false };
  world.step(input, 0, STEP);
  fail('pistolFires', world.entities.bullets.length >= 1 && p.ammo === ammo0 - 1);
  // 8. Save round-trips through localStorage.
  writeSave(saveData);
  fail('saveRoundtrip', readSave() !== null);
  // 9. No NaN anywhere it matters.
  let nan = false;
  for (const c of world.entities.cars) if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) nan = true;
  for (const d of world.entities.peds) if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) nan = true;
  fail('noNaN', !nan && Number.isFinite(p.x) && Number.isFinite(p.y));
  const passed = Object.values(checks).every(Boolean);
  window.__testResult = { name: 'core', passed, checks };
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  // Reads the queued presses and returns the ones the simulation should see
  // this frame (0 when a menu ate them).
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.muted = !audio.muted;
      setMuted(audio, audio.muted);
      world.say(audio.muted ? 'Sound muted.' : 'Sound on.', '#9a938a');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        if (saveData.missionsDone > 0 || saveData.cash > 0) continueGame();
        else newGame();
      }
      return 0;
    }
    if (screen === SCREEN_END) {
      if (actions & ACTION_CONFIRM) {
        world.respawn();
        screen = SCREEN_PLAY;
      }
      return 0;
    }
    if (screen === SCREEN_HELP) {
      if (actions & (ACTION_HELP | ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PAUSED;
      return 0;
    }
    if (actions & ACTION_HELP) {
      screen = SCREEN_HELP;
      return 0;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      return 0;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_RELOAD)) {
      const p = world.entities.player;
      if (!p.car && p.ammo < PISTOL.ammo) {
        p.ammo = PISTOL.ammo;
        world.say('Reloaded.', '#9a938a');
      }
    }
    return screen === SCREEN_PLAY ? actions : 0;
  }

  // N on the title screen starts a fresh game even when a save exists.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && screen === SCREEN_TITLE && !event.repeat) newGame();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        world.step(input, first ? actions : 0, STEP);
        first = false;
        accumulator -= STEP;
        if (world.entities.player.dead) {
          screen = SCREEN_END;
          accumulator = 0;
          break;
        }
      }
      stepAudio(audio, world, frameDt);
    } else if (screen === SCREEN_TITLE) {
      // The title's backdrop city idles: traffic moves, nothing can hurt the player.
      while (accumulator >= STEP) {
        world.step(input, 0, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, saveData);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  announce('Vice Harbor. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (test) runTests();
else runGame();
