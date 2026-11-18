# VICE HARBOR — Port Meridian

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/yogigill31/gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/yogigill31/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down open-world crime game for the **Make GTA 6** bounty on
[make.fun](https://make.fun/bounty/gta6-01). You are **Rook Calloway**, a driver
for hire in **Port Meridian** — a sun-soaked grid city of docks, neon streets,
parks and warehouses. Fixer **Marla Vane** has five jobs for you, and the whole
city — traffic, pedestrians, the Meridian PD — reacts to everything you do.

Play it here: https://make.fun/r/et3ycqwq

## How to play

- **On foot**: walk the streets, punch, shoot, and steal any car you can reach.
- **In a car**: drive, ram, handbrake-turn, and outrun the police.
- **Wanted level**: stealing, shooting and hurting people raises your stars.
  Police cars chase and foot cops arrest. Stay out of sight and the heat cools.
- **Missions**: follow the yellow `!` on the minimap. Five chained jobs —
  a pickup, a car theft, a police escape, a gang payback, and one last big
  score at the Bank of Meridian. Finishing a job pays cash and unlocks the next.
- **Save**: cash and mission progress save automatically. Continue from the
  title screen picks up where you left off. Getting busted costs $100 in fines;
  getting wasted costs $150.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (W accelerate, S brake, A/D steer) |
| E | Enter or exit a car (steal it if it isn't yours) |
| Space | Shoot the pistol (on foot) / handbrake (in a car) |
| F | Punch |
| R | Reload |
| Shift | Sprint on foot / boost in a car |
| P / Esc | Pause |
| H | Help |
| M | Mute |

## Systems

- **City**: a seeded 12×8 block grid — roads, sidewalks, traffic lights,
  buildings, parks, the Meridian Docks, Neon Row, Civic Plaza, The Yard,
  the Bank of Meridian, Warehouse Row, Meridian PD, St. Anselm Hospital,
  and the harbor boat. The same seed builds the same city.
- **Traffic & pedestrians**: cars keep to their lanes, stop at red lights and
  slow for the car ahead; pedestrians stroll the sidewalks and flee gunfire
  and police chases.
- **Police**: wanted levels 0–5 set how many police cars and foot cops hunt
  you; wanted decays when you stay out of sight.
- **Combat**: pistol with ammo, punches, ramming, gang members who shoot back,
  health and ammo pickups, car damage and wrecks.
- **HUD & minimap**: health, cash, wanted stars, ammo, clock, mission
  objective with distance, and a live minimap (player, traffic, police,
  mission marker, north).
- **Polish**: day/night cycle with dusk lighting and headlights, procedural
  WebAudio (engine hum, sirens, gunshots, pickup jingles, a bassline loop),
  particles (sparks, smoke, muzzle flash), screen shake, pause and help.

## Play it locally

```sh
node serve.ts
# open http://localhost:8080
```

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-game.ts`.

## Screenshots

1. `1-start.jpg` — title screen over Port Meridian at dusk.
2. `2-play.jpg` — driving through the city with traffic.
3. `3-chase.jpg` — wanted level 3, police cars in pursuit.
4. `4-mission.jpg` — the mission marker at Meridian Docks.

Every name, character, place and story beat is invented for this game.
Nothing is taken from any commercial game.
