import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import { AuthService } from './auth.service';

export type ChallengeType = 'Claim' | 'Steal';

export interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  summary: string;
  furtherDetails: string;
  createdByName: string;
  createdAt: string;
  /** Only the author may change or remove a challenge. */
  isYours: boolean;
}

export interface ChallengePage {
  challenges: Challenge[];
  nextCursor: string | null;
}

export interface NewChallenge {
  type: ChallengeType;
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

  get(id: string): Promise<Challenge> {
    return this.api.get<Challenge>(`/api/challenges/${encodeURIComponent(id)}`);
  }

  create(challenge: NewChallenge): Promise<Challenge> {
    return this.api.post<Challenge>('/api/challenges', {
      ...challenge,
      displayName: this.authService.currentUser?.name ?? '',
    });
  }

  /** Authorship isn't sent: editing your wording doesn't change who wrote it. */
  update(id: string, challenge: NewChallenge): Promise<Challenge> {
    return this.api.put<Challenge>(`/api/challenges/${encodeURIComponent(id)}`, challenge);
  }

  remove(id: string): Promise<void> {
    return this.api.delete<void>(`/api/challenges/${encodeURIComponent(id)}`);
  }
}
