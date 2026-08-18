import { Component } from '@angular/core';
import { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/angular';
import { Challenge, ChallengeService } from '../challenge.service';

@Component({
  selector: 'app-challenges',
  templateUrl: 'challenges.page.html',
  styleUrls: ['challenges.page.scss'],
  standalone: false,
})
export class ChallengesPage {
  challenges: Challenge[] = [];

  /** The challenge whose further details are open. Null means the modal is closed. */
  selected: Challenge | null = null;

  loading = false;
  error: string | null = null;

  private nextCursor: string | null = null;

  constructor(private challengeService: ChallengeService) {}

  /** Reloads on entry so a challenge just added on the next screen appears on the way back. */
  ionViewWillEnter(): void {
    void this.reload();
  }

  get hasMore(): boolean {
    return this.nextCursor !== null;
  }

  async reload(event?: RefresherCustomEvent): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const page = await this.challengeService.list();
      this.challenges = page.challenges;
      this.nextCursor = page.nextCursor;
    } catch {
      this.error = 'Could not load challenges.';
    } finally {
      this.loading = false;
      await event?.target.complete();
    }
  }

  async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    if (this.nextCursor === null) {
      await event.target.complete();
      return;
    }

    try {
      const page = await this.challengeService.list(this.nextCursor);
      this.challenges = [...this.challenges, ...page.challenges];
      this.nextCursor = page.nextCursor;
    } catch {
      this.error = 'Could not load more challenges.';
    } finally {
      await event.target.complete();
    }
  }

  openDetails(challenge: Challenge): void {
    this.selected = challenge;
  }

  closeDetails(): void {
    this.selected = null;
  }
}
