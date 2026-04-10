# Triplanetary Web App — Product Requirements Document

**Version:** 0.1 (Draft)  
**Stack:** React + boardgame.io · SVG map · Node server (Railway / Render / Fly.io)  
**Status:** Planning

---

## 1. Overview

A faithful digital adaptation of the 2018 third-edition *Triplanetary* board game by Steve Jackson Games. The app supports full multiplayer (2–6 players), persistent accounts, a single-player AI mode, and the complete ruleset including the campaign game. The first shipped scenario is **Bi-Planetary** (the introductory learning scenario); all other scenarios and the campaign follow in subsequent releases.

---

## 2. Goals

| Goal | Detail |
|---|---|
| Faithful rules implementation | All 2018 edition rules — vector movement, gravity, ordnance, advanced combat, campaign |
| Authentic map | SVG recreation of the original inner Solar System hex map |
| Multiplayer | 2–6 human players, simultaneous plotting with sequential resolution |
| AI opponent | Playable single-player vs a bot |
| Persistent accounts | Profiles, game history, stats |
| Extensible | Scenario system designed to add all 10 scenarios + campaign iteratively |

---

## 3. Non-Goals (v1)

- Mobile-native app (web-responsive is fine)
- Real-time asteroid / planet movement (static map per rulebook intent)
- Spectator mode
- Ranked / ELO matchmaking
- Scenarios beyond Bi-Planetary at launch

---

## 4. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (Vite) | Component-based, good boardgame.io support |
| Game engine | boardgame.io | Turn management, state, multiplayer, AI |
| Map rendering | SVG | Scalable, hit-testable hexes, easy vector drawing |
| Auth | Passport.js or Auth.js | Username/password + session persistence |
| Database | PostgreSQL | Player profiles, game history, campaign state |
| Hosting | Railway / Render / Fly.io | Node server required for boardgame.io multiplayer |
| Real-time | boardgame.io's built-in Socket.io transport | |

---

## 5. Architecture

```
┌──────────────────────────────────────┐
│              React Client             │
│  ┌─────────┐  ┌────────┐  ┌───────┐ │
│  │ SVG Map │  │ UI HUD │  │Lobby  │ │
│  └─────────┘  └────────┘  └───────┘ │
│         boardgame.io Client SDK       │
└────────────────┬─────────────────────┘
                 │ WebSocket
┌────────────────┴─────────────────────┐
│           Node.js Server              │
│   boardgame.io Server (Multiplayer)   │
│   Auth API  │  REST API               │
└──────────┬────────────────────────────┘
           │
      PostgreSQL
```

### boardgame.io Game Object Modules

| Module | Responsibility |
|---|---|
| `G.map` | Hex grid, gravity arrows, astral bodies, bases |
| `G.ships` | All ship counters — position, vector, fuel, damage, cargo |
| `G.ordnance` | Active mines, torpedoes, nukes and their vectors |
| `G.turn` | Phase tracking, player order, simultaneous plot state |
| `G.campaign` | MCr balances, fleet ownership, cycle tracking |
| `ctx` | boardgame.io standard context (player IDs, phase, activePlayers) |

---

## 6. Core Features

### 6.1 Hex Map (SVG)

**Hex library:** [honeycomb.js](https://abbekeultjes.nl/honeycomb/) (v4+) handles all hex math — axial coordinates, neighbor lookups, distance, line-of-sight, ring/range queries. The SVG layer is rendered on top using honeycomb's coordinate output.

**Hex orientation:** Pointy-top hexes to match the original Triplanetary map layout.

**Coordinate system:** Axial coordinates `(q, r)` throughout. A `HEX_DATA` static JSON file maps every named hex to its axial coordinate plus metadata:

```jsonc
// hex-data.json (excerpt)
{
  "hexes": {
    "0,0":   { "type": "space" },
    "2,-3":  { "type": "gravity", "body": "venus",  "offset": [0, 1] },
    "3,-3":  { "type": "gravity", "body": "venus",  "offset": [-1, 1] },
    "5,-1":  { "type": "planet", "body": "venus" },
    "7,2":   { "type": "asteroid" },
    "0,4":   { "type": "gravity", "body": "terra",  "offset": [0, -1], "weak": false },
    ...
  },
  "bases": {
    "terra": ["0,3", "1,3", "0,5", "-1,4", "1,4", "-1,3"],
    "ceres": ["12,1"],
    ...
  }
}
```

**Rendering pipeline:**

```
honeycomb Grid  →  SVG <polygon> per hex  →  overlay layers
     ↓
  axial (q,r)   →  pixel (x,y) via        →  1. hex fills (type-based color)
  coordinates      honeycomb.hexToPoint()  →  2. gravity arrows (SVG <marker>)
                                           →  3. astral body SVG paths
                                           →  4. ship counters (SVG <g>)
                                           →  5. course vectors (SVG <line>+<marker>)
                                           →  6. UI overlays (range rings, highlights)
```

**Key honeycomb.js usage:**

```js
import { defineHex, createHexGrid, ring, spiral, line } from 'honeycomb-grid'

const Hex = defineHex({ dimensions: HEX_SIZE, orientation: 'pointy' })

// Neighbor lookup (for gravity, adjacency checks)
const neighbors = grid.neighborsOf(hex)

// Range highlight (valid plotting destinations, detector range)
const inRange = ring({ center: shipHex, radius: 1 })   // 1-fuel destinations
const detectorField = ring({ center: baseHex, radius: 5 }) // planetary detector

// Distance (range modifier for combat)
const dist = grid.distance(attackerHex, defenderHex)

// Line of sight (blocked by planets/Sol)
const sightLine = line({ start: attackerHex, stop: targetHex })
const blocked = sightLine.some(h => hexData[h.toString()].type === 'planet')
```

**Astral body outlines:** SVG `<path>` elements positioned using honeycomb pixel coordinates, used for crash detection (point-in-path test on each movement step).

**Interaction:**
- Each `<polygon>` hex has an `onClick` handler passing its axial coordinate
- Hover state tracked in React for highlight rendering
- Ship counters are SVG `<g>` elements positioned at `hexToPoint(shipHex)`

**Map is pannable and zoomable** via react-zoom-pan-pinch.

**Detector range rings** displayed on hover/select using honeycomb `ring()` queries.

---

### 6.1a Map Editor

The map editor is an internal tool (admin/dev only, not player-facing) used to author and maintain the `HEX_DATA` JSON that drives every game map — including the canonical Triplanetary solar system map and any custom maps for campaign or future scenarios.

**Access:** `/admin/map-editor` route, gated behind an `ADMIN` role flag on the user account.

#### Editor Modes

The editor has a toolbar that switches between modes. Clicking a hex applies the current mode's action to that hex.

| Mode | Action |
|---|---|
| **Select** | Click to inspect hex data in sidebar |
| **Space** | Mark hex as clear space (default) |
| **Asteroid** | Toggle asteroid hazard flag |
| **Planet** | Place an astral body (Sol, planet, moon, major asteroid) — opens body picker |
| **Base** | Assign a base to a hex-side (1–6) of an adjacent planet hex |
| **Gravity** | Auto-computed from planet positions (see below); manual override available |
| **Weak Gravity** | Mark a gravity hex as weak (Luna / Io rule) |
| **Clandestine** | Mark the secret base hex and its colored asteroid ring |
| **Erase** | Reset hex to default space |

#### Gravity Auto-Computation

When an astral body is placed (or moved), the editor automatically computes gravity for all surrounding hexes:

```
For each hex H adjacent to body B (and the ring at radius 2 for large bodies):
  1. Compute the axial vector from H toward B's center hex
  2. Normalize to the nearest of the 6 axial directions
  3. Assign that direction as H's gravity offset [dq, dr]
  4. Flag the hex type as "gravity", linked to body B
```

For bodies with larger gravity footprints (Jupiter, Sol), the editor extends this to radius 2 or 3 hexes as configured per body.

**Manual override:** After auto-computation, the editor user can click any gravity hex and manually change its offset direction using a 6-direction rosette picker. Overrides are stored with a `"manual": true` flag so they survive re-computation if the body moves.

**Weak gravity flag:** Gravity hexes around Luna and Io can be toggled to `"weak": true` in the editor, which triggers the weak-gravity rules during play.

#### Computed `HEX_DATA` Output Schema

```jsonc
{
  "meta": {
    "name": "Triplanetary — Inner Solar System",
    "version": "1.0",
    "hexSize": 48,
    "orientation": "pointy"
  },
  "bodies": {
    "terra":  { "center": "0,4",  "radius": 1, "gravityRings": 1 },
    "luna":   { "center": "1,5",  "radius": 0, "gravityRings": 1, "weakGravity": true },
    "venus":  { "center": "-4,2", "radius": 1, "gravityRings": 1 },
    "mars":   { "center": "5,-3", "radius": 1, "gravityRings": 1 },
    "sol":    { "center": "0,0",  "radius": 3, "gravityRings": 2 },
    "ceres":  { "center": "9,1",  "gravityRings": 0, "asteroidBase": true },
    ...
  },
  "hexes": {
    "0,4":   { "type": "planet",   "body": "terra" },
    "0,3":   { "type": "gravity",  "body": "terra", "offset": [0,-1], "manual": false },
    "1,3":   { "type": "gravity",  "body": "terra", "offset": [-1,-1], "manual": false },
    "-1,4":  { "type": "gravity",  "body": "terra", "offset": [1,0],  "manual": true },
    "1,5":   { "type": "planet",   "body": "luna",  "weakGravity": true },
    "7,2":   { "type": "asteroid" },
    "11,3":  { "type": "clandestine", "coloredAsteroids": ["11,2","12,3","10,4"] }
  },
  "bases": {
    "terra":  { "hexSides": [0,1,2,3,4,5] },
    "venus":  { "hexSides": [0,1,2,3,4,5] },
    "luna":   { "hexSides": [2] },
    "ceres":  { "hexSides": [0], "asteroidBase": true, "torpedo": true },
    "clandestine": { "hexSides": [0], "asteroidBase": true, "torpedo": true, "secret": true }
  }
}
```

#### Editor UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Map Editor]  Map: "Inner Solar System v1.0"  [Save] [Export]│
├──────────────────┬───────────────────────────────────────────┤
│  TOOLBAR         │                                           │
│  ○ Select        │                                           │
│  ○ Space         │         SVG HEX GRID                      │
│  ○ Asteroid      │         (pan + zoom)                      │
│  ○ Planet ▾      │                                           │
│  ○ Base          │    Gravity arrows auto-drawn              │
│  ○ Gravity       │    Planet outlines overlaid               │
│  ○ Weak Gravity  │                                           │
│  ○ Clandestine   │                                           │
│  ○ Erase         │                                           │
│                  │                                           │
│  ─────────────── ├───────────────────────────────────────────┤
│  SELECTED HEX    │  HEX INSPECTOR                            │
│  q: 0  r: 3      │  type: gravity                            │
│                  │  body: terra                              │
│  [Recompute All  │  offset: [0, -1]  [↑↗↘↓↙↖] ← override  │
│   Gravity]       │  manual: false                            │
│                  │  [ Mark Weak ]  [ Erase ]                 │
└──────────────────┴───────────────────────────────────────────┘
```

#### Map Versioning & Storage

- Maps are stored in the database as versioned JSON blobs
- The canonical Triplanetary map is seeded on first deploy (version-locked)
- Custom maps (for campaign or community scenarios) can be created, named, and saved
- Export to `.json` for backup or sharing
- The game engine loads `HEX_DATA` once at game creation and stores a snapshot in the boardgame.io `G.map` state — the live game never reads from the database mid-game

### 6.2 Vector Movement (Click-to-Plot)

The core mechanic. Each ship has a current velocity vector (tail = last position, head = current position).

**Plotting flow:**
1. Player clicks a ship they own during the Astrogation phase.
2. App computes the "predicted endpoint" — where the ship would land with no thrust (current vector applied).
3. Predicted endpoint is highlighted. Adjacent hexes (reachable with 1 fuel burn) are also highlighted.
4. Player clicks a destination hex:
   - Same as predicted endpoint = coast (no fuel spent)
   - Adjacent hex = 1 fuel spent, circle drawn at vector base
   - Overload (2 hexes, warships only, once per maintenance stopover) = 2 fuel spent, double-circle drawn
5. New vector is drawn as an SVG line with arrowhead from current position to chosen endpoint.
6. Fuel counter decremented on confirmation.

**Gravity resolution (automatic, server-side):**
- On movement phase, server applies gravity hex offsets accumulated during the previous turn
- Gravity is mandatory and cumulative; resolved before player movement is applied
- Weak gravity (Luna, Io): player prompted to use or ignore first hex; second+ are mandatory

**Visual conventions (per rulebook):**
- Solid line = actual course
- Dotted point = predicted destination
- Small circle at vector base = fuel burn
- Double circle = overload
- Turn number label on each vector
- Stationary ship = square symbol in hex

### 6.3 Simultaneous Plotting

boardgame.io's `activePlayers` stage system manages this:

1. **Astrogation Stage** — all players are active simultaneously. Each player plots courses for all their ships privately. When done, they "lock in."
2. Once all players lock in, server resolves gravity, then executes all movement simultaneously.
3. **Ordnance Stage** — simultaneous declaration of ordnance launches.
4. **Movement Phase** — server animates all ships moving along their vectors. Collision checks run server-side (mines, torpedoes, asteroids, crashes, ramming attempts).
5. **Combat Phase** — sequential (in player order) gun combat declarations; counterattacks resolved before damage applied.
6. **Resupply Phase** — refueling, repairs, cargo transfers.

Players can see other ships' previous vectors but not the current turn's plots until resolution.

### 6.4 Combat

**Gun combat:**
- Attacker selects attacking ship(s) and target(s)
- App computes odds ratio (attacker CS : defender CS), rounds in defender's favor
- Applies range modifier: −1 per hex of range (measured from attacker's closest approach to defender's final position)
- Applies relative velocity modifier: −1 per hex of velocity difference > 2 (plot both vectors from common point, count hex separation)
- Rolls die server-side, looks up Gun Combat Damage table
- D-suffix ships (Transport, Tanker, Liner) may not attack or counterattack

**Counterattack:**
- Defender(s) may return fire before damage is implemented
- Any ship in victim's hex sharing its course may join counterattack

**Advanced Combat System (optional, per game setup):**
- Two-roll system: To-Hit roll, then per-hit Damage roll (weapon / drive / structure)
- Tracked separately per ship
- Dreadnaught exception: can still fire at weapon D1–D3
- Ship lootable only when it can neither maneuver nor fire

### 6.5 Ordnance

| Type | Mass | Launched by | Notes |
|---|---|---|---|
| Mine | 10t | Any ship with cargo space | Assumes launching ship's vector; ship must immediately change course; active 5 turns; detonates on course intersection |
| Torpedo | 20t | Warships only | Mine + launch-turn acceleration up to 2 hexes; hits one target only |
| Nuke | 20t | Any ship (1 at a time for non-warships) | Destroys everything in hex; devastates planetary hexside; scenario-gated |

Ordnance moves in the phasing player's movement phase. Affected by gravity. Self-destructs after 5 turns. Nukes can be targeted by guns at 2:1.

### 6.6 Bases & Resupply

**Planetary bases:** Planetary defense fire (2:1, no range/velocity modifier), refueling, maintenance (clears all damage + resets overload), ordnance reload. Ship immune from guns/mines/torpedoes/ramming while landed (not nukes).

**Asteroid bases (Ceres, Clandestine):** No planetary defenses; can launch 1 torpedo/turn; immune except to nukes.

**Orbital bases:** Purchasable (MCr 1000), carried by transport/packet, placed in gravity hex or planetary hexside. Provides fuel, ordnance, torpedo launch. Cannot be moved once placed.

**Resupply restriction:** Ship may not fire guns or launch ordnance on a turn it resupplies.

### 6.7 Special Rules

- **Torch ships:** Unlimited fuel; cannot transfer fuel to others
- **Clandestine:** Hidden base; colored asteroids require scanners to enter; pirate/rebel owner's ships treat them as clear space
- **Heroism:** Ship attacking at <1:1 and achieving D2+ becomes heroic; permanent +1 to attack die rolls
- **Looting/Capture:** Requires course match with disabled/surrendered ship
- **Surrender:** Binding bargain; surrendered ship must be left with fuel to reach friendly base
- **Ramming:** Movement phase; ramming ship's course must pass through target's hex center; die roll minus vector difference >2

---

## 7. Scenarios

### 7.1 Launch: Bi-Planetary

| Setting | Value |
|---|---|
| Players | 2 |
| Ships | 1 Corvette each (Mars vs Venus) |
| Goal | Navigate to the other world and land |
| Winner | Fewest turns |
| Optional variant | Mercury vs Ganymede |
| Tutorial | Yes — guided UI overlays for first-time players |

### 7.2 Roadmap Scenarios (post-launch)

Grand Tour → Escape → Lateral 7 → Nova → Piracy → Retribution → Fleet Mutiny → Interplanetary War → Prospecting → Campaign

Each scenario unlocks additional rules modules (ordnance, nukes, campaign economy, Clandestine, prospecting equipment).

---

## 8. AI Opponent

boardgame.io supports `AI` bots via MCTS (Monte Carlo Tree Search) or custom `enumerate` + heuristic bots.

**Phase 1 (launch):** Rule-based bot for Bi-Planetary
- Heuristic: compute shortest valid vector path to target world, avoid gravity crashes, burn fuel efficiently
- Difficulty: single level ("Competent Pilot")

**Phase 2:** MCTS bot scaffolding for combat scenarios

**Phase 3:** Per-scenario tuned heuristics for campaign roles (Patrol, Merchant, Pirate)

---

## 9. User Accounts & Lobby

### Authentication
- Email/password registration with email verification
- Session-based auth (httpOnly cookie)
- Player profile: display name, avatar (initials or upload), stats

### Lobby
- Create game room → choose scenario, player count, AI slots, advanced combat on/off, nuke rules
- Share room code or link
- Players join and select faction/color
- Host starts game when ready
- Rejoin on disconnect (boardgame.io persists game state)

### Profile & History
- Games played, won, lost per scenario
- Campaign standings (ongoing)
- Ship kill/loss records

---

## 10. Campaign Game

- Uses MCr purchase system
- Roles: Patrol, Merchants (1+), Pirates (1), Prospectors (optional)
- Each player manages their own MCr balance, fleet, and delivery cycles
- Server tracks: base ownership, MCr per player, cycle state, pirate detection status, cargo manifests
- Sessions can be saved and resumed across multiple play sessions
- Optional Referee role: human or rules-enforcement automation
- Campaign-specific rules: fuel free; prize ships; pirate re-entry after 20 turns; Patrol budget per detection status

---

## 11. UI / UX

### Layout
```
┌─────────────────────────────────────────────────────┐
│  [Game Title]   [Turn N]   [Phase]   [Player Order] │
├────────────────────────────┬────────────────────────┤
│                            │  Selected Ship Panel   │
│                            │  ┌──────────────────┐ │
│      SVG HEX MAP           │  │ Ship type / name │ │
│      (pan + zoom)          │  │ CS / Fuel / Cargo│ │
│                            │  │ Damage status    │ │
│                            │  │ Ordnance load    │ │
│                            │  └──────────────────┘ │
│                            │  Action Buttons        │
│                            │  [Plot] [Launch] [End] │
│                            ├────────────────────────┤
│                            │  Combat Log            │
│                            │  (scrollable)          │
└────────────────────────────┴────────────────────────┘
```

### Key UX Decisions
- **Plotting:** Click ship → valid destinations highlight → click destination → vector drawn; confirm or re-plot
- **Gravity preview:** When plotting, show projected gravity effects on the new vector as a ghost line
- **Simultaneous phase indicator:** Each player's "ready" status shown as avatar checkmarks
- **Combat resolution:** Animated die roll; damage result shown with before/after ship status
- **Colorblind-safe palette:** Ship faction colors chosen for accessibility
- **Rules reference:** In-app sidebar with searchable rules, scenario setup, ship stat table

---

## 12. Data Model (simplified)

```
User { id, email, passwordHash, displayName, avatar, createdAt }

Game { id, scenarioId, state (boardgame.io JSON), status, createdAt, updatedAt }

GamePlayer { gameId, userId, playerIndex, faction, result }

CampaignGame { id, name, refereeUserId, mcr[], fleets[], cycleState, createdAt }
```

---

## 13. Phased Delivery

### Phase 1 — Foundation (Bi-Planetary playable)
- **Map editor** (admin tool) with auto-computed gravity, manual overrides, versioned storage
- Canonical Triplanetary map authored and seeded via map editor
- SVG hex map renderer consuming `HEX_DATA`
- Click-to-plot vector movement + gravity resolution
- Simultaneous astrogation + sequential movement resolution
- Gun combat (standard system)
- 2-player Bi-Planetary scenario
- Accounts, lobby, room codes
- AI bot (rule-based) for Bi-Planetary

### Phase 2 — Combat & Ordnance
- Mines, torpedoes, nukes
- Advanced Combat System (optional)
- Planetary defenses, base resupply
- Orbital bases
- Add 3–4 more scenarios (Grand Tour, Escape, Lateral 7, Nova)

### Phase 3 — Full Scenario Suite
- Remaining scenarios (Piracy, Retribution, Fleet Mutiny, Interplanetary War, Prospecting)
- Prospecting equipment, ore, CT shards
- Clandestine full rules
- MCTS AI improvements

### Phase 4 — Campaign
- Campaign game full implementation
- Multi-session persistence
- Referee tools
- Campaign stats and history

---

## 14. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Licensing | Free fan project, no monetization. Send a courtesy email to Steve Jackson Games before public launch. The 2018 rulebook explicitly grants personal-use copying rights, which establishes good faith. |
| 2 | Map editor access | Admin-only at launch. Phase 3+ opens it to players for community custom maps, with a submission/moderation queue before maps go public. |
| 3 | Gravity edge cases | Auto-compute from body position; manual override with `"manual": true` flag preserves corrections across recomputes. One-time audit pass against physical map after initial authoring. |
| 4 | Simultaneous plot visibility | **Current** ship positions and vectors (from previous turns) are always visible to all players. **This turn's** newly plotted vectors are hidden until both sides commit — revealed simultaneously on resolution. |
| 5 | Async vs. real-time | **Async only.** Players notified by email/in-app when it's their turn to plot. No live session required. boardgame.io state persistence handles this natively. |
| 6 | Scenario availability | All scenarios visible in the lobby from day one. Unimplemented ones shown as "Coming Soon" (greyed out, no launch button). |
| 7 | AI difficulty | Single difficulty level ("Pilot") at launch. Additional levels added in Phase 3. |
| 8 | Hex size | **48px** default. Map is pan/zoomable; 48px gives a good overview while zoom brings counters to full readability. Configured as a `HEX_SIZE` constant. |
| 9 | Gravity ring radius | **Configurable per body in the map editor.** Each body entry has a `gravityRings` integer field set during authoring. Defaults: Sol=2, Jupiter=2, planets=1, moons=1. Adjusted during the initial map audit pass. |
