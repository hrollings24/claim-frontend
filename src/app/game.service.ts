import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import { AuthService } from './auth.service';

export type GameStatus = 'Lobby' | 'InProgress';

export interface GamePlayer {
  name: string;
  isHost: boolean;
  isYou: boolean;
}

export interface Game {
  code: string;
  status: GameStatus;
  youAreHost: boolean;
  players: GamePlayer[];
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

  /**
   * The API is called with the Cognito access token, which carries no name claim, so the
   * display name has to be sent alongside the request. It comes from the id token.
   */
  private membership(): { displayName: string } {
    return { displayName: this.authService.currentUser?.name ?? '' };
  }
}
