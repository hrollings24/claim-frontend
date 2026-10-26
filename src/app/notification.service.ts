import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';

/**
 * A copy of a notification the game sent you, kept for a week whether or not it reached a
 * device — so you can catch up on what happened while your phone was in your pocket.
 */
export interface InboxNotification {
  id: string;
  /** The game it's about. */
  gameCode: string | null;
  title: string;
  body: string;
  /** Where tapping it goes, e.g. that game's screen. */
  url: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private api: ApiClient) {}

  /** Newest first, from every game. */
  list(): Promise<InboxNotification[]> {
    return this.api.get<InboxNotification[]>('/api/notifications');
  }

  dismiss(id: string): Promise<void> {
    return this.api.delete<void>(`/api/notifications/${encodeURIComponent(id)}`);
  }

  dismissAll(): Promise<void> {
    return this.api.delete<void>('/api/notifications');
  }
}
