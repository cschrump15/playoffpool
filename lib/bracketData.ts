// 2026 NCAA Tournament - Real bracket data (announced March 16, 2026)
// First Four play-in winners shown as TBD with both options

export type Region = 'East' | 'West' | 'Midwest' | 'South'

export interface Team {
  seed: number
  name: string
  isPlayIn?: boolean // true if this team still needs to win a First Four game
}

export interface Matchup {
  id: string        // e.g. "E-1-16" = East, seeds 1 vs 16
  region: Region
  round: number     // 64 = R64, 32 = R32, etc.
  team1: Team
  team2: Team
  gameNumber: number // position in bracket (1-32 for R64)
}

export interface RoundConfig {
  round: number
  label: string
  shortLabel: string
  basePoints: number
  bonusPoints: number
  spreadBands: SpreadBand[]
}

export interface SpreadBand {
  label: string       // e.g. "Team 1 by 16+"
  minMargin: number   // lower bound (inclusive), negative = Team 2 wins
  maxMargin: number   // upper bound (inclusive), null = infinity
  team: 1 | 2
}

// ---------------------------------------------------------------------------
// SCORING CONFIG
// ---------------------------------------------------------------------------
export const ROUND_CONFIG: Record<number, RoundConfig> = {
  64: {
    round: 64,
    label: 'Round of 64',
    shortLabel: 'R64',
    basePoints: 2,
    bonusPoints: 1,
    spreadBands: [
      { label: 'by 16+',   minMargin: 16,  maxMargin: 999, team: 1 },
      { label: 'by 11-15', minMargin: 11,  maxMargin: 15,  team: 1 },
      { label: 'by 6-10',  minMargin: 6,   maxMargin: 10,  team: 1 },
      { label: 'by 1-5',   minMargin: 1,   maxMargin: 5,   team: 1 },
      { label: 'by 1-5',   minMargin: 1,   maxMargin: 5,   team: 2 },
      { label: 'by 6-10',  minMargin: 6,   maxMargin: 10,  team: 2 },
      { label: 'by 11-15', minMargin: 11,  maxMargin: 15,  team: 2 },
      { label: 'by 16+',   minMargin: 16,  maxMargin: 999, team: 2 },
    ],
  },
  32: {
    round: 32,
    label: 'Round of 32',
    shortLabel: 'R32',
    basePoints: 3,
    bonusPoints: 1,
    spreadBands: [
      { label: 'by 16+',   minMargin: 16,  maxMargin: 999, team: 1 },
      { label: 'by 11-15', minMargin: 11,  maxMargin: 15,  team: 1 },
      { label: 'by 6-10',  minMargin: 6,   maxMargin: 10,  team: 1 },
      { label: 'by 1-5',   minMargin: 1,   maxMargin: 5,   team: 1 },
      { label: 'by 1-5',   minMargin: 1,   maxMargin: 5,   team: 2 },
      { label: 'by 6-10',  minMargin: 6,   maxMargin: 10,  team: 2 },
      { label: 'by 11-15', minMargin: 11,  maxMargin: 15,  team: 2 },
      { label: 'by 16+',   minMargin: 16,  maxMargin: 999, team: 2 },
    ],
  },
  16: {
    round: 16,
    label: 'Sweet 16',
    shortLabel: 'S16',
    basePoints: 4,
    bonusPoints: 2,
    spreadBands: [
      { label: 'by 13+',  minMargin: 13,  maxMargin: 999, team: 1 },
      { label: 'by 9-12', minMargin: 9,   maxMargin: 12,  team: 1 },
      { label: 'by 5-8',  minMargin: 5,   maxMargin: 8,   team: 1 },
      { label: 'by 1-4',  minMargin: 1,   maxMargin: 4,   team: 1 },
      { label: 'by 1-4',  minMargin: 1,   maxMargin: 4,   team: 2 },
      { label: 'by 5-8',  minMargin: 5,   maxMargin: 8,   team: 2 },
      { label: 'by 9-12', minMargin: 9,   maxMargin: 12,  team: 2 },
      { label: 'by 13+',  minMargin: 13,  maxMargin: 999, team: 2 },
    ],
  },
  8: {
    round: 8,
    label: 'Elite Eight',
    shortLabel: 'E8',
    basePoints: 6,
    bonusPoints: 2,
    spreadBands: [
      { label: 'by 13+',  minMargin: 13,  maxMargin: 999, team: 1 },
      { label: 'by 9-12', minMargin: 9,   maxMargin: 12,  team: 1 },
      { label: 'by 5-8',  minMargin: 5,   maxMargin: 8,   team: 1 },
      { label: 'by 1-4',  minMargin: 1,   maxMargin: 4,   team: 1 },
      { label: 'by 1-4',  minMargin: 1,   maxMargin: 4,   team: 2 },
      { label: 'by 5-8',  minMargin: 5,   maxMargin: 8,   team: 2 },
      { label: 'by 9-12', minMargin: 9,   maxMargin: 12,  team: 2 },
      { label: 'by 13+',  minMargin: 13,  maxMargin: 999, team: 2 },
    ],
  },
  4: {
    round: 4,
    label: 'Final Four',
    shortLabel: 'F4',
    basePoints: 8,
    bonusPoints: 3,
    spreadBands: [
      { label: 'by 10+', minMargin: 10,  maxMargin: 999, team: 1 },
      { label: 'by 7-9', minMargin: 7,   maxMargin: 9,   team: 1 },
      { label: 'by 4-6', minMargin: 4,   maxMargin: 6,   team: 1 },
      { label: 'by 1-3', minMargin: 1,   maxMargin: 3,   team: 1 },
      { label: 'by 1-3', minMargin: 1,   maxMargin: 3,   team: 2 },
      { label: 'by 4-6', minMargin: 4,   maxMargin: 6,   team: 2 },
      { label: 'by 7-9', minMargin: 7,   maxMargin: 9,   team: 2 },
      { label: 'by 10+', minMargin: 10,  maxMargin: 999, team: 2 },
    ],
  },
  2: {
    round: 2,
    label: 'Championship',
    shortLabel: 'CG',
    basePoints: 10,
    bonusPoints: 4,
    spreadBands: [
      { label: 'by 10+', minMargin: 10,  maxMargin: 999, team: 1 },
      { label: 'by 7-9', minMargin: 7,   maxMargin: 9,   team: 1 },
      { label: 'by 4-6', minMargin: 4,   maxMargin: 6,   team: 1 },
      { label: 'by 1-3', minMargin: 1,   maxMargin: 3,   team: 1 },
      { label: 'by 1-3', minMargin: 1,   maxMargin: 3,   team: 2 },
      { label: 'by 4-6', minMargin: 4,   maxMargin: 6,   team: 2 },
      { label: 'by 7-9', minMargin: 7,   maxMargin: 9,   team: 2 },
      { label: 'by 10+', minMargin: 10,  maxMargin: 999, team: 2 },
    ],
  },
}

export const ROUND_ORDER = [64, 32, 16, 8, 4, 2]

// ---------------------------------------------------------------------------
// 2026 BRACKET — Round of 64 matchups
// Ordered by game number within each region (determines bracket path)
// ---------------------------------------------------------------------------
export const R64_MATCHUPS: Matchup[] = [
  // ── EAST ──────────────────────────────────────────────────────────────────
  { id: 'E-1',  region: 'East', round: 64, gameNumber: 1,  team1: { seed: 1,  name: 'Duke' },         team2: { seed: 16, name: 'Siena' } },
  { id: 'E-2',  region: 'East', round: 64, gameNumber: 2,  team1: { seed: 8,  name: 'Ohio State' },   team2: { seed: 9,  name: 'TCU' } },
  { id: 'E-3',  region: 'East', round: 64, gameNumber: 3,  team1: { seed: 5,  name: "St. John's" },   team2: { seed: 12, name: 'Northern Iowa' } },
  { id: 'E-4',  region: 'East', round: 64, gameNumber: 4,  team1: { seed: 4,  name: 'Kansas' },       team2: { seed: 13, name: 'Cal Baptist' } },
  { id: 'E-5',  region: 'East', round: 64, gameNumber: 5,  team1: { seed: 6,  name: 'Louisville' },   team2: { seed: 11, name: 'South Florida' } },
  { id: 'E-6',  region: 'East', round: 64, gameNumber: 6,  team1: { seed: 3,  name: 'Michigan State' }, team2: { seed: 14, name: 'North Dakota State' } },
  { id: 'E-7',  region: 'East', round: 64, gameNumber: 7,  team1: { seed: 7,  name: 'UCLA' },         team2: { seed: 10, name: 'UCF' } },
  { id: 'E-8',  region: 'East', round: 64, gameNumber: 8,  team1: { seed: 2,  name: 'UConn' },        team2: { seed: 15, name: 'Furman' } },

  // ── WEST ──────────────────────────────────────────────────────────────────
  { id: 'W-1',  region: 'West', round: 64, gameNumber: 9,  team1: { seed: 1,  name: 'Arizona' },      team2: { seed: 16, name: 'LIU' } },
  { id: 'W-2',  region: 'West', round: 64, gameNumber: 10, team1: { seed: 8,  name: 'Villanova' },    team2: { seed: 9,  name: 'Utah State' } },
  { id: 'W-3',  region: 'West', round: 64, gameNumber: 11, team1: { seed: 5,  name: 'Wisconsin' },    team2: { seed: 12, name: 'High Point' } },
  { id: 'W-4',  region: 'West', round: 64, gameNumber: 12, team1: { seed: 4,  name: 'Arkansas' },     team2: { seed: 13, name: 'Hawaii' } },
  { id: 'W-5',  region: 'West', round: 64, gameNumber: 13, team1: { seed: 6,  name: 'BYU' },          team2: { seed: 11, name: 'Texas/NC State', isPlayIn: true } },
  { id: 'W-6',  region: 'West', round: 64, gameNumber: 14, team1: { seed: 3,  name: 'Gonzaga' },      team2: { seed: 14, name: 'Kennesaw State' } },
  { id: 'W-7',  region: 'West', round: 64, gameNumber: 15, team1: { seed: 7,  name: 'Miami (FL)' },   team2: { seed: 10, name: 'Missouri' } },
  { id: 'W-8',  region: 'West', round: 64, gameNumber: 16, team1: { seed: 2,  name: 'Purdue' },       team2: { seed: 15, name: 'Queens' } },

  // ── MIDWEST ───────────────────────────────────────────────────────────────
  { id: 'M-1',  region: 'Midwest', round: 64, gameNumber: 17, team1: { seed: 1,  name: 'Michigan' },  team2: { seed: 16, name: 'UMBC/Howard', isPlayIn: true } },
  { id: 'M-2',  region: 'Midwest', round: 64, gameNumber: 18, team1: { seed: 8,  name: 'Georgia' },   team2: { seed: 9,  name: 'St. Louis' } },
  { id: 'M-3',  region: 'Midwest', round: 64, gameNumber: 19, team1: { seed: 5,  name: 'Texas Tech' }, team2: { seed: 12, name: 'Akron' } },
  { id: 'M-4',  region: 'Midwest', round: 64, gameNumber: 20, team1: { seed: 4,  name: 'Alabama' },   team2: { seed: 13, name: 'Hofstra' } },
  { id: 'M-5',  region: 'Midwest', round: 64, gameNumber: 21, team1: { seed: 6,  name: 'Tennessee' }, team2: { seed: 11, name: 'SMU/Miami (OH)', isPlayIn: true } },
  { id: 'M-6',  region: 'Midwest', round: 64, gameNumber: 22, team1: { seed: 3,  name: 'Virginia' },  team2: { seed: 14, name: 'Wright State' } },
  { id: 'M-7',  region: 'Midwest', round: 64, gameNumber: 23, team1: { seed: 7,  name: 'Kentucky' },  team2: { seed: 10, name: 'Santa Clara' } },
  { id: 'M-8',  region: 'Midwest', round: 64, gameNumber: 24, team1: { seed: 2,  name: 'Iowa State' }, team2: { seed: 15, name: 'Tennessee State' } },

  // ── SOUTH ─────────────────────────────────────────────────────────────────
  { id: 'S-1',  region: 'South', round: 64, gameNumber: 25, team1: { seed: 1,  name: 'Florida' },     team2: { seed: 16, name: 'PV A&M/Lehigh', isPlayIn: true } },
  { id: 'S-2',  region: 'South', round: 64, gameNumber: 26, team1: { seed: 8,  name: 'Clemson' },     team2: { seed: 9,  name: 'Iowa' } },
  { id: 'S-3',  region: 'South', round: 64, gameNumber: 27, team1: { seed: 5,  name: 'Vanderbilt' },  team2: { seed: 12, name: 'McNeese' } },
  { id: 'S-4',  region: 'South', round: 64, gameNumber: 28, team1: { seed: 4,  name: 'Nebraska' },    team2: { seed: 13, name: 'Troy' } },
  { id: 'S-5',  region: 'South', round: 64, gameNumber: 29, team1: { seed: 6,  name: 'North Carolina' }, team2: { seed: 11, name: 'VCU' } },
  { id: 'S-6',  region: 'South', round: 64, gameNumber: 30, team1: { seed: 3,  name: 'Illinois' },    team2: { seed: 14, name: 'Penn' } },
  { id: 'S-7',  region: 'South', round: 64, gameNumber: 31, team1: { seed: 7,  name: "Saint Mary's" }, team2: { seed: 10, name: 'Texas A&M' } },
  { id: 'S-8',  region: 'South', round: 64, gameNumber: 32, team1: { seed: 2,  name: 'Houston' },     team2: { seed: 15, name: 'Idaho' } },
]

// ---------------------------------------------------------------------------
// SCORING UTILITIES
// ---------------------------------------------------------------------------

/**
 * Given a pick (winner + spreadBandIndex) and the actual result (winner + final margin),
 * return points earned.
 */
export function calculatePoints(
  roundSize: number,
  pickedTeam: 1 | 2,
  pickedBandIndex: number,
  actualWinner: 1 | 2,
  actualMargin: number // always positive, represents winning margin
): number {
  const config = ROUND_CONFIG[roundSize]
  if (!config) return 0

  const correctWinner = pickedTeam === actualWinner
  if (!correctWinner) return 0

  const base = config.basePoints
  const band = config.spreadBands[pickedBandIndex]
  if (!band) return base

  const correctTeam = band.team === actualWinner
  const correctMargin = actualMargin >= band.minMargin && actualMargin <= band.maxMargin
  const bonus = correctTeam && correctMargin ? config.bonusPoints : 0

  return base + bonus
}

export function getSpreadBandLabel(roundSize: number, bandIndex: number, team1Name: string, team2Name: string): string {
  const config = ROUND_CONFIG[roundSize]
  if (!config) return ''
  const band = config.spreadBands[bandIndex]
  if (!band) return ''
  const teamName = band.team === 1 ? team1Name : team2Name
  return `${teamName} ${band.label}`
}

export function maxPossiblePoints(roundSize: number): number {
  const config = ROUND_CONFIG[roundSize]
  if (!config) return 0
  return config.basePoints + config.bonusPoints
}
