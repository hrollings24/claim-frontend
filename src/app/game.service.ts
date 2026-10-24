import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import { AuthService } from './auth.service';

export type GameStatus = 'Lobby' | 'InProgress' | 'Finished';

export interface GamePlayer {
  name: string;
  isHost: boolean;
  isYou: boolean;
  teamId: string | null;
}

export interface GameTeam {
  id: string;
  name: string;
}

export interface ActiveBorough {
  id: string;
  name: string;
  zone: 'Inner' | 'Outer';
  isHot: boolean;
}

/** Nothing is ever locked — any held borough can be stolen. */
export interface Territory {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  /** Locked by Fortify: it can't be stolen for the rest of the game. */
  isFortified: boolean;
}

/** A claim challenge. The hand holds nothing else. */
export interface HandCard {
  id: string;
  title: string;
  summary: string;
  furtherDetails: string;
  /** Power cards completing it draws — doubled on the hot borough. */
  powerDraws: number;
}

/**
 * Steal, Reverse (Curse Reverse), Fortify and Swap are built in. Curse (cast on another team) and
 * Boost (played on yourself) are written by players.
 */
export type PowerKind = 'Steal' | 'Curse' | 'Boost' | 'Reverse' | 'Fortify' | 'Swap';

/** One colour per kind, used everywhere a power card shows its kind. */
export function powerKindColor(kind: PowerKind): string {
  switch (kind) {
    case 'Steal':
      return 'danger';
    case 'Boost':
      return 'success';
    case 'Reverse':
    case 'Fortify':
    case 'Swap':
      return 'tertiary';
    default:
      return 'warning';
  }
}

export type StealOutcome = 'Succeeded' | 'Failed' | 'TimedOut';

/** The challenge a played Steal revealed, and its clock. */
export interface StealAttempt {
  boroughId: string;
  boroughName: string;
  title: string;
  summary: string;
  furtherDetails: string;
  expiresAt: string;
  /** Null while the clock is running. */
  outcome: StealOutcome | null;
}

/** Played cards stay in the list, marked by playedAt, so a team can see what it has used. */
export interface PowerCard {
  id: string;
  kind: PowerKind;
  title: string;
  description: string;
  /** Curse only; null lasts until the cursed team clears it. */
  durationMinutes: number | null;
  playedAt: string | null;
  /** What it was played on — a team, a borough, a curse. */
  playedOn: string | null;
  steal: StealAttempt | null;
}

/** An active curse your team cast or is under. */
export interface Curse {
  id: string;
  title: string;
  description: string;
  fromTeamName: string;
  targetTeamName: string;
  /** True when it's on your team, false when your team cast it. */
  onYou: boolean;
  startedAt: string;
  /** Null for one that lasts until the cursed team clears it. */
  endsAt: string | null;
  /** Sent back by Curse Reverse — it can't be reversed again. */
  isReversal: boolean;
}

/** A Swap you've played and not finished: the other team's power cards, revealed to pick from. */
export interface PendingSwap {
  cardId: string;
  teamId: string;
  teamName: string;
  theirCards: PowerCard[];
}

/** A steal running against one of your boroughs, so you know it's coming. */
export interface IncomingSteal {
  id: string;
  boroughId: string;
  boroughName: string;
  fromTeamName: string;
  title: string;
  summary: string;
  expiresAt: string;
}

/** Cards drawn and waiting for the team to keep up to `keep` of them; the rest are discarded. */
export interface PowerOffer {
  id: string;
  reason: string;
  keep: number;
  cards: PowerCard[];
}

export interface TeamScore {
  teamId: string;
  name: string;
  territories: number;
  bonusPoints: number;
  score: number;
}

export interface GameBoard {
  active: ActiveBorough[];
  hotBoroughId: string | null;
  hotRotatesAt: string;
  territories: Territory[];
  yourHand: HandCard[];
  yourPowers: PowerCard[];
  yourPowerOffers: PowerOffer[];
  activeCurses: Curse[];
  incomingSteals: IncomingSteal[];
  yourSwaps: PendingSwap[];
  /** Unplayed power cards a team may hold at once. */
  maxPowerCards: number;
  /** Left to draw before the discard pile is shuffled back in. */
  powerDeckCount: number;
  powerDiscardCount: number;
  scores: TeamScore[];
  endsAt: string | null;
}

export interface Game {
  code: string;
  status: GameStatus;
  youAreHost: boolean;
  yourTeamId: string | null;
  durationMinutes: number;
  hotRotationMinutes: number;
  /** Boroughs on the board, picked by the host. Null leaves it to the game: `defaultBoardSize`. */
  boardSize: number | null;
  defaultBoardSize: number;
  /** Picked by the host in the lobby; a game can't start without one. */
  powerConfigurationId: string | null;
  powerConfigurationName: string | null;
  players: GamePlayer[];
  teams: GameTeam[];
  board: GameBoard | null;
}

/** The API explains refusals in a ProblemDetails title — prefer it over a generic message. */
export function joinFailureMessage(error: unknown): string {
  if ((error as { status?: number })?.status === 404) {
    return 'No game found with that code.';
  }

  return (error as { error?: { title?: string } })?.error?.title ?? 'Could not join that game.';
}

@Injectable({ providedIn: 'root' })
export class GameService {
  constructor(
    private api: ApiClient,
    private authService: AuthService,
  ) {}

  create(): Promise<Game> {
    return this.api.post<Game>('/api/games', this.membership());
  }

  get(code: string): Promise<Game> {
    return this.api.get<Game>(`/api/games/${encodeURIComponent(code)}`);
  }

  /** Every game the caller still has a seat in, so the join page can offer a way back. */
  mine(): Promise<Game[]> {
    return this.api.get<Game[]>('/api/games/mine');
  }

  join(code: string): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/join`, this.membership());
  }

  leave(code: string): Promise<void> {
    return this.api.post<void>(`/api/games/${encodeURIComponent(code)}/leave`);
  }

  start(code: string): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/start`);
  }

  createTeam(code: string, name: string): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/teams`, { name });
  }

  /** Also how a player switches: their team becomes whichever one they pick. */
  joinTeam(code: string, teamId: string): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/teams/${encodeURIComponent(teamId)}/join`,
    );
  }

  leaveTeam(code: string): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/teams/leave`);
  }

  /**
   * Plays a claim challenge at an active borough, reporting whether it came off. A success
   * claims it and draws power cards, which arrive as an offer to choose from.
   */
  playCard(code: string, cardId: string, boroughId: string, succeeded: boolean): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/play`, {
      cardId,
      boroughId,
      succeeded,
    });
  }

  /** Keeps the chosen cards from an offer; the rest are discarded. An empty list turns it down. */
  keepPowers(code: string, offerId: string, cardIds: string[]): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/powers/offers/${encodeURIComponent(offerId)}/keep`,
      { cardIds },
    );
  }

  /**
   * Plays a power card. A Steal needs a target borough — its challenge is revealed and the clock
   * starts from this moment, with no way back. A curse needs a target team.
   */
  playPower(
    code: string,
    cardId: string,
    target: { boroughId?: string; targetTeamId?: string } = {},
  ): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/powers/${encodeURIComponent(cardId)}/play`,
      target,
    );
  }

  /** Uses a Curse Reverse on a curse aimed at your team. */
  respondToCurse(code: string, curseId: string, cardId: string): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/curses/${encodeURIComponent(curseId)}/respond`,
      { cardId },
    );
  }

  /** Marks a curse with no time on it as done. */
  clearCurse(code: string, curseId: string): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/curses/${encodeURIComponent(curseId)}/clear`,
    );
  }

  /**
   * Finishes a played Swap: take one of their cards, give one of yours. Either is left out only
   * when that side has nothing left.
   */
  completeSwap(code: string, swapCardId: string, takeCardId: string | null, giveCardId: string | null): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/powers/${encodeURIComponent(swapCardId)}/swap`,
      { takeCardId, giveCardId },
    );
  }

  /** Null hands it back to the game's default for the number of teams. */
  setBoardSize(code: string, boardSize: number | null): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/board-size`, { boardSize });
  }

  /** Reports whether a running steal came off. Refused once its clock has run out. */
  resolveSteal(code: string, cardId: string, succeeded: boolean): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/powers/${encodeURIComponent(cardId)}/resolve`,
      { succeeded },
    );
  }

  /** Throws away an unplayed power card to make room under the limit. */
  discardPower(code: string, cardId: string): Promise<Game> {
    return this.api.post<Game>(
      `/api/games/${encodeURIComponent(code)}/powers/${encodeURIComponent(cardId)}/discard`,
    );
  }

  setPowerConfiguration(code: string, configurationId: string): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/power-configuration`, {
      configurationId,
    });
  }

  setDuration(code: string, durationMinutes: number): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/duration`, {
      durationMinutes,
    });
  }

  setHotRotation(code: string, hotRotationMinutes: number): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/hot-rotation`, {
      hotRotationMinutes,
    });
  }

  /**
   * The API is called with the Cognito access token, which carries no name claim, so the
   * display name has to be sent alongside the request. It comes from the id token.
   */
  private membership(): { displayName: string } {
    return { displayName: this.authService.currentUser?.name ?? '' };
  }
}
