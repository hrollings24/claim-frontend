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
  /** Steal only. Null means the default — the challenge predates this setting. */
  stealMinutes: number | null;
  createdByName: string;
  createdAt: string;
  /** Only the author may change or remove a challenge. */
  isYours: boolean;
}

export interface NewChallenge {
  type: ChallengeType;
  title: string;
  summary: string;
  furtherDetails: string;
  stealMinutes: number | null;
}

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  constructor(
    private api: ApiClient,
    private authService: AuthService,
  ) {}

  /** The whole deck, alphabetically. Small enough to hold, and filtering it is instant. */
  list(): Promise<Challenge[]> {
    return this.api.get<Challenge[]>('/api/challenges');
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
