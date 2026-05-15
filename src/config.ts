// Tunable constants for Starball. Single source of truth for palette, sprite
// sizes, physics constants, star types, scoring coefficients.

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const LOGICAL_W = 640;
export const LOGICAL_H = 360;
export const HUD_H = 40;
export const PLAYFIELD_H = LOGICAL_H - HUD_H; // 320

export const WINDOW_SCALE = 2;
export const WINDOW_W = LOGICAL_W * WINDOW_SCALE;
export const WINDOW_H = LOGICAL_H * WINDOW_SCALE;

export const TARGET_FPS = 60;
export const PHYSICS_HZ = 120;
export const PHYSICS_DT = 1.0 / PHYSICS_HZ;

// ---------------------------------------------------------------------------
// Palette: DawnBringer 32
// https://lospec.com/palette-list/dawnbringer-32
// Index 0 is black (used as the universal sprite outline).
// ---------------------------------------------------------------------------

export type Color = readonly [number, number, number];

export const PALETTE: readonly Color[] = [
  [0x00, 0x00, 0x00], // 0 black (outline)
  [0x22, 0x20, 0x34], // 1 valhalla
  [0x45, 0x28, 0x3c], // 2 loulou
  [0x66, 0x39, 0x31], // 3 oiled cedar
  [0x8f, 0x56, 0x3b], // 4 rope
  [0xdf, 0x71, 0x26], // 5 dirty orange
  [0xd9, 0xa0, 0x66], // 6 light tan
  [0xee, 0xc3, 0x9a], // 7 cream
  [0xfb, 0xf2, 0x36], // 8 yellow
  [0x99, 0xe5, 0x50], // 9 light green
  [0x6a, 0xbe, 0x30], // 10 green
  [0x37, 0x94, 0x6e], // 11 dark green
  [0x4b, 0x69, 0x2f], // 12 forest green
  [0x52, 0x4b, 0x24], // 13 olive
  [0x32, 0x3c, 0x39], // 14 dark slate
  [0x3f, 0x3f, 0x74], // 15 deep blue
  [0x30, 0x60, 0x82], // 16 dark blue
  [0x5b, 0x6e, 0xe1], // 17 royal blue
  [0x63, 0x9b, 0xff], // 18 light blue
  [0x5f, 0xcd, 0xe4], // 19 cyan
  [0xcb, 0xdb, 0xfc], // 20 pale cyan
  [0xff, 0xff, 0xff], // 21 white
  [0x9b, 0xad, 0xb7], // 22 silver
  [0x84, 0x7e, 0x87], // 23 gray
  [0x69, 0x6a, 0x6a], // 24 dark gray
  [0x59, 0x56, 0x52], // 25 charcoal
  [0x76, 0x42, 0x8a], // 26 purple
  [0xac, 0x32, 0x32], // 27 red
  [0xd9, 0x57, 0x63], // 28 pink
  [0xd7, 0x7b, 0xba], // 29 light pink
  [0x8f, 0x97, 0x4a], // 30 yellow olive
  [0x8a, 0x6f, 0x30], // 31 dark olive
];

// Named colors for readability
export const BLACK = PALETTE[0];
export const WHITE = PALETTE[21];
export const YELLOW = PALETTE[8];
export const RED = PALETTE[27];
export const ORANGE = PALETTE[5];
export const LIGHT_BLUE = PALETTE[18];
export const CYAN = PALETTE[19];
export const PALE_CYAN = PALETTE[20];
export const DARK_GRAY = PALETTE[24];
export const CHARCOAL = PALETTE[25];
export const PURPLE = PALETTE[26];
export const SILVER = PALETTE[22];

export const BG_COLOR = PALETTE[1]; // dark blue-purple — space
export const HUD_BG = PALETTE[14];  // dark slate

// Player colors (Battle mode)
export const P1_COLOR = PALETTE[8];  // bright yellow
export const P2_COLOR = PALETTE[19]; // cyan

export function colorToCss(c: Color): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function colorToCssAlpha(c: Color, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Physics constants (logical px, seconds — tuned for feel, not real units)
// ---------------------------------------------------------------------------

export const G_GRAV = 8000.0;
export const WALL_DAMPING = 0.9;
export const STOP_VEL = 5.0;
export const STOP_ACC = 50.0;
export const STOP_DURATION_S = 1.0;
export const NO_PROGRESS_TIMEOUT_S = 20.0;
export const HARD_TIMEOUT_S = 35.0;
export const STUCK_WINDOW_S = 5.0;
export const STUCK_BBOX_THRESHOLD = 100.0;

export const MIN_POWER_PCT = 10;
export const MAX_POWER_PCT = 100;
export const SPEED_AT_MIN_POWER = 80.0;
export const SPEED_AT_MAX_POWER = 360.0;

// Hard cap on lives during a Play run. The +1-on-goal reward never carries
// the player above this — prevents indefinite life-stacking.
export const LIVES_CAP = 5;

// ---------------------------------------------------------------------------
// Star types
// ---------------------------------------------------------------------------

export type ForceModel =
  | "newtonian"
  | "newtonian_with_repulsion"
  | "capped_pull";

export interface StarParams {
  readonly radius: number;
  readonly mass: number;
  readonly softening: number;
  readonly color: Color;
  readonly forceModel: ForceModel;
  // Black-hole specific:
  readonly captureRadius?: number;
  readonly aMax?: number;
  // Blue-giant specific:
  readonly repulsionRadiusMult?: number;
  readonly repulsionK?: number;
}

export type StarType =
  | "brown_dwarf"
  | "standard"
  | "blue_giant"
  | "red_giant"
  | "black_hole";

export const STAR_TYPES: Readonly<Record<StarType, StarParams>> = {
  brown_dwarf: {
    radius: 6,
    mass: 60.0,
    softening: 3.0,
    color: PALETTE[3],
    forceModel: "newtonian",
  },
  standard: {
    radius: 10,
    mass: 200.0,
    softening: 5.0,
    color: YELLOW,
    forceModel: "newtonian",
  },
  blue_giant: {
    radius: 16,
    mass: 300.0,
    softening: 8.0,
    color: LIGHT_BLUE,
    forceModel: "newtonian_with_repulsion",
    repulsionRadiusMult: 2.0,
    repulsionK: 3000.0,
  },
  red_giant: {
    radius: 20,
    mass: 180.0,
    softening: 10.0,
    color: RED,
    forceModel: "newtonian",
  },
  black_hole: {
    radius: 8,
    captureRadius: 16,
    mass: 0.0,
    softening: 0.0,
    color: BLACK,
    forceModel: "capped_pull",
    aMax: 5000.0,
  },
};

// ---------------------------------------------------------------------------
// Field / map generation
// ---------------------------------------------------------------------------

export const LAUNCHER_MARGIN_X = 24;
export const GOAL_MARGIN_X = 24;
export const LAUNCHER_GOAL_MIN_SEP = 360;
export const GOAL_RADIUS_MIN = 10;
export const GOAL_RADIUS_MAX = 14;
export const STAR_MIN_SEPARATION_MULT = 1.6;
export const MAX_STARS_PER_MAP = 6;
export const MAP_REJECTION_LIMIT = 20;

// Per-instance radius scaling for blue/red giants. Mapgen rolls a uniform
// multiplier in this range; mass is intentionally NOT scaled.
export const GIANT_RADIUS_MIN_MULT = 1.0;
export const GIANT_RADIUS_MAX_MULT = 2.0;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const SCORE_BASE = 100;
export const K_CURV = 300.0;
export const K_GRAZE = 5.0;
export const C_STAR_MAX = 1500.0;
export const CURVATURE_GLOBAL_CAP = 5000.0;
export const GRAZE_RADIUS_MULT = 3.0;
export const TIME_DECAY_TAU = 1.5;

// Slow goals are usually luck more than skill — apply a multiplier to the
// final score that decays from 1.0 → FLOOR as flight time grows past the
// grace period. Grace + window are picked so the multiplier hits the floor
// right around NO_PROGRESS_TIMEOUT_S.
export const FLIGHT_TIME_GRACE_S = 6.0;
export const FLIGHT_TIME_PENALTY_WINDOW_S = 14.0;
export const FLIGHT_TIME_PENALTY_FLOOR = 0.1;

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

export type DifficultyCurve = "gentle" | "normal" | "hard";
export type TrajectoryPreviewMode = "off" | "first_second" | "full";

export interface Settings {
  version: number;
  volume_master: number;
  volume_sfx: number;
  volume_music: number;
  fullscreen: boolean;
  lives: number; // 0 = unlimited
  difficulty: DifficultyCurve;
  trajectory_preview: TrajectoryPreviewMode;
  player1_name: string;
  player2_name: string;
  angle_step_deg: number;
  power_step_pct: number;
  shift_multiplier: number;
  hotseat_rounds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  volume_master: 0.8,
  volume_sfx: 1.0,
  volume_music: 0.6,
  fullscreen: false,
  lives: 3,
  difficulty: "normal",
  trajectory_preview: "off",
  player1_name: "P1",
  player2_name: "P2",
  angle_step_deg: 1,
  power_step_pct: 1,
  shift_multiplier: 5,
  hotseat_rounds: 4,  // even so each player starts the same number of times
};
