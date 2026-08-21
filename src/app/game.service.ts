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

export interface Territory {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  isLocked: boolean;
  lockedUntil: string | null;
}

export interface HandCard {
  id: string;
  type: 'Claim' | 'Steal';
  title: string;
  summary: string;
  furtherDetails: string;
}

export interface TeamScore {
  teamId: string;
  name: string;
  territories: number;
  bonusPoints: number;
  score: number;
}

export interface CounterWindow {
  againstTeamId: string;
  againstTeamName: string;
  expiresAt: string;
}

export interface GameBoard {
  active: ActiveBorough[];
  hotBoroughId: string | null;
  hotRotatesAt: string;
  territories: Territory[];
  yourHand: HandCard[];
  scores: TeamScore[];
  yourCounterWindow: CounterWindow | null;
  endsAt: string | null;
}

export interface Game {
  code: string;
  status: GameStatus;
  youAreHost: boolean;
  yourTeamId: string | null;
  durationMinutes: number;
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
   * Plays a card at a borough, reporting whether the challenge came off. The server works out
   * whether that is a claim, a steal or a counter-attack.
   */
  playCard(code: string, cardId: string, boroughId: string, succeeded: boolean): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/play`, {
      cardId,
      boroughId,
      succeeded,
    });
  }

  setDuration(code: string, durationMinutes: number): Promise<Game> {
    return this.api.post<Game>(`/api/games/${encodeURIComponent(code)}/duration`, {
      durationMinutes,
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
