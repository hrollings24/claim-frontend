import { GameTeam } from './game.service';

/**
 * The colours a team can pick, under the same ids the API accepts (TeamColors on the server).
 * Orange and white are deliberately missing: the map uses them for the hot borough and for
 * boroughs on the board, so a team can never be mistaken for either.
 */
export const TEAM_COLORS: ReadonlyArray<{ id: string; name: string; hex: string }> = [
  { id: 'red', name: 'Red', hex: '#ef4444' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6' },
  { id: 'green', name: 'Green', hex: '#22c55e' },
  { id: 'purple', name: 'Purple', hex: '#a855f7' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
  { id: 'teal', name: 'Teal', hex: '#14b8a6' },
  { id: 'yellow', name: 'Yellow', hex: '#facc15' },
  { id: 'cyan', name: 'Cyan', hex: '#22d3ee' },
  { id: 'lime', name: 'Lime', hex: '#a3e635' },
  { id: 'indigo', name: 'Indigo', hex: '#6366f1' },
  { id: 'brown', name: 'Brown', hex: '#8b5a2b' },
  { id: 'magenta', name: 'Magenta', hex: '#d946ef' },
];

/** Reserved for the map — never a team's. */
export const MAP_COLORS = {
  hot: '#f97316',
  active: '#ffffff',
  /** Not on the board and not held: drawn as part of the background. */
  idle: '#24364d',
} as const;

/**
 * A team's colour. Teams made before colours existed have none, so they're given a free one
 * for display, in team order, without saving anything.
 */
export function teamHex(team: GameTeam, teams: GameTeam[]): string {
  const own = TEAM_COLORS.find(c => c.id === team.color);
  if (own) {
    return own.hex;
  }

  const taken = new Set(teams.map(t => t.color));
  const free = TEAM_COLORS.filter(c => !taken.has(c.id));
  const uncoloured = teams.filter(t => !TEAM_COLORS.some(c => c.id === t.color));

  return free[uncoloured.indexOf(team) % Math.max(1, free.length)]?.hex ?? '#9ca3af';
}

/** Dark text on light colours (yellow, lime, cyan, white), white text on the rest. */
export function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.6 ? '#0b1b30' : '#ffffff';
}
