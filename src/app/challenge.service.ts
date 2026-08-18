import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import { AuthService } from './auth.service';

export interface Challenge {
  id: string;
  title: string;
  summary: string;
  furtherDetails: string;
  createdByName: string;
  createdAt: string;
}

export interface ChallengePage {
  challenges: Challenge[];
  nextCursor: string | null;
}

export interface NewChallenge {
  title: string;
  summary: string;
  furtherDetails: string;
}

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  constructor(
    private api: ApiClient,
    private authService: AuthService,
  ) {}

  /** Newest first. Pass the previous page's cursor to continue from where it stopped. */
  list(cursor?: string | null): Promise<ChallengePage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

    return this.api.get<ChallengePage>(`/api/challenges${query}`);
  }

  create(challenge: NewChallenge): Promise<Challenge> {
    return this.api.post<Challenge>('/api/challenges', {
      ...challenge,
      displayName: this.authService.currentUser?.name ?? '',
    });
  }
}
