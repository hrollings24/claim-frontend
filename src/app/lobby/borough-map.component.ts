import { Component, Input } from '@angular/core';
import { GameBoard, GameTeam } from '../game.service';
import { MAP_COLORS, teamHex, textOn } from '../team-colors';

/**
 * Where each borough sits on the tile map: one square each, roughly where it is in London.
 * A diagram rather than a real map — every borough the same size, so the small inner ones are
 * as easy to read and tap as Bromley. Ids match the API's borough catalogue.
 */
const LAYOUT: ReadonlyArray<{ id: string; code: string; col: number; row: number }> = [
  { id: 'enfield', code: 'ENF', col: 4, row: 0 },

  { id: 'harrow', code: 'HRW', col: 2, row: 1 },
  { id: 'barnet', code: 'BAR', col: 3, row: 1 },
  { id: 'haringey', code: 'HGY', col: 4, row: 1 },
  { id: 'waltham-forest', code: 'WFO', col: 5, row: 1 },

  { id: 'hillingdon', code: 'HIL', col: 0, row: 2 },
  { id: 'ealing', code: 'EAL', col: 1, row: 2 },
  { id: 'brent', code: 'BRE', col: 2, row: 2 },
  { id: 'camden', code: 'CMD', col: 3, row: 2 },
  { id: 'islington', code: 'ISL', col: 4, row: 2 },
  { id: 'hackney', code: 'HCK', col: 5, row: 2 },
  { id: 'redbridge', code: 'RED', col: 6, row: 2 },
  { id: 'havering', code: 'HAV', col: 7, row: 2 },

  { id: 'hounslow', code: 'HNS', col: 0, row: 3 },
  { id: 'hammersmith-and-fulham', code: 'HMF', col: 1, row: 3 },
  { id: 'kensington-and-chelsea', code: 'KEN', col: 2, row: 3 },
  { id: 'westminster', code: 'WST', col: 3, row: 3 },
  { id: 'tower-hamlets', code: 'TOW', col: 4, row: 3 },
  { id: 'newham', code: 'NWM', col: 5, row: 3 },
  { id: 'barking-and-dagenham', code: 'BKD', col: 6, row: 3 },

  { id: 'richmond-upon-thames', code: 'RCH', col: 0, row: 4 },
  { id: 'wandsworth', code: 'WNS', col: 1, row: 4 },
  { id: 'lambeth', code: 'LAM', col: 2, row: 4 },
  { id: 'southwark', code: 'SWK', col: 3, row: 4 },
  { id: 'lewisham', code: 'LEW', col: 4, row: 4 },
  { id: 'greenwich', code: 'GRN', col: 5, row: 4 },
  { id: 'bexley', code: 'BEX', col: 6, row: 4 },

  { id: 'kingston-upon-thames', code: 'KIN', col: 0, row: 5 },
  { id: 'merton', code: 'MRT', col: 1, row: 5 },
  { id: 'sutton', code: 'STN', col: 2, row: 5 },
  { id: 'croydon', code: 'CRY', col: 3, row: 5 },
  { id: 'bromley', code: 'BRM', col: 4, row: 5 },
];

const COLS = 8;
const ROWS = 6;
const CELL = 10;
const GAP = 0.8;

interface Tile {
  id: string;
  code: string;
  name: string;
  x: number;
  y: number;
  fill: string;
  text: string;
  /** What tapping it says. */
  caption: string;
  hot: boolean;
  active: boolean;
  fortified: boolean;
}

@Component({
  selector: 'app-borough-map',
  templateUrl: 'borough-map.component.html',
  styleUrls: ['borough-map.component.scss'],
  standalone: false,
})
export class BoroughMapComponent {
  @Input({ required: true }) board!: GameBoard;
  @Input({ required: true }) teams!: GameTeam[];
  @Input() yourTeamId: string | null = null;

  readonly viewBox = `0 0 ${COLS * CELL} ${ROWS * CELL}`;
  readonly size = CELL - GAP;
  readonly colors = MAP_COLORS;

  selectedId: string | null = null;

  get tiles(): Tile[] {
    const active = new Map(this.board.active.map(a => [a.id, a]));
    const held = new Map(this.board.territories.map(t => [t.id, t]));

    return LAYOUT.map(place => {
      const territory = held.get(place.id);
      const onBoard = active.get(place.id);
      const name = territory?.name ?? onBoard?.name ?? this.nameFromId(place.id);
      const hot = onBoard?.isHot ?? false;

      let fill: string = MAP_COLORS.idle;
      let caption = `${name} — not on the board yet`;

      if (territory) {
        const team = this.teams.find(t => t.id === territory.teamId);
        fill = team ? teamHex(team, this.teams) : '#9ca3af';
        const whose = territory.teamId === this.yourTeamId ? 'yours' : `held by ${territory.teamName}`;
        caption = `${name} — ${whose}${territory.isFortified ? ', fortified' : ''}`;
      } else if (hot) {
        fill = MAP_COLORS.hot;
        caption = `${name} — hot, worth 2 points and double power cards`;
      } else if (onBoard) {
        fill = MAP_COLORS.active;
        caption = `${name} — on the board, up for grabs`;
      }

      return {
        id: place.id,
        code: place.code,
        name,
        x: place.col * CELL + GAP / 2,
        y: place.row * CELL + GAP / 2,
        fill,
        text: fill === MAP_COLORS.idle ? 'rgba(255,255,255,0.45)' : textOn(fill),
        caption,
        hot,
        active: !!onBoard,
        fortified: territory?.isFortified ?? false,
      };
    });
  }

  get selectedCaption(): string | null {
    return this.tiles.find(t => t.id === this.selectedId)?.caption ?? null;
  }

  /** Each team's swatch for the key, in the scoreboard's order. */
  get legend(): { name: string; hex: string }[] {
    return this.teams.map(team => ({ name: team.name, hex: teamHex(team, this.teams) }));
  }

  select(tile: Tile): void {
    this.selectedId = this.selectedId === tile.id ? null : tile.id;
  }

  trackTile(_: number, tile: Tile): string {
    return tile.id;
  }

  /** For a borough that is neither on the board nor held, so the API sent no name for it. */
  private nameFromId(id: string): string {
    return id
      .split('-')
      .map(word => (['and', 'upon'].includes(word) ? word : word[0].toUpperCase() + word.slice(1)))
      .join(' ');
  }
}
