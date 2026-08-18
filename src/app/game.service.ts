import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { fetchAuthSession } from 'aws-amplify/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
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

@Injectable({ providedIn: 'root' })
export class GameService {
  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  create(): Promise<Game> {
    return this.request<Game>('post', '/api/games', this.membership());
  }

  get(code: string): Promise<Game> {
    return this.request<Game>('get', `/api/games/${encodeURIComponent(code)}`);
  }

  join(code: string): Promise<Game> {
    return this.request<Game>('post', `/api/games/${encodeURIComponent(code)}/join`, this.membership());
  }

  leave(code: string): Promise<void> {
    return this.request<void>('post', `/api/games/${encodeURIComponent(code)}/leave`);
  }

  start(code: string): Promise<Game> {
    return this.request<Game>('post', `/api/games/${encodeURIComponent(code)}/start`);
  }

  /**
   * The API is called with the Cognito access token, which carries no name claim, so the
   * display name has to be sent alongside the request. It comes from the id token.
   */
  private membership(): { displayName: string } {
    return { displayName: this.authService.currentUser?.name ?? '' };
  }

  private async request<T>(method: 'get' | 'post', path: string, body?: unknown): Promise<T> {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken?.toString();
    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    const url = `${environment.apiUrl}${path}`;

    const response$ =
      method === 'get'
        ? this.http.get<T>(url, { headers })
        : this.http.post<T>(url, body ?? {}, { headers });

    return firstValueFrom(response$);
  }
}
