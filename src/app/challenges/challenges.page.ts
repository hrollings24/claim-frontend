import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/angular';
import { problemMessage } from '../api-client.service';
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

  constructor(
    private challengeService: ChallengeService,
    private zone: NgZone,
    private router: Router,
    private alerts: AlertController,
  ) {}

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

  async edit(challenge: Challenge): Promise<void> {
    this.closeDetails();
    await this.router.navigateByUrl(`/challenges/${challenge.id}/edit`);
  }

  /** Removing a challenge takes it out of the deck for everyone, so it asks first. */
  async confirmDelete(challenge: Challenge): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Delete challenge',
      message: `"${challenge.title}" will be removed from the deck for everyone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => void this.remove(challenge) },
      ],
    });

    await alert.present();
  }

  private async remove(challenge: Challenge): Promise<void> {
    this.closeDetails();
    try {
      await this.challengeService.remove(challenge.id);
      this.challenges = this.challenges.filter(c => c.id !== challenge.id);
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = problemMessage(error, 'Could not delete that challenge.');
      });
    }
  }

  openDetails(challenge: Challenge): void {
    this.selected = challenge;
  }

  /**
   * Ionic moves the modal out of this page and into ion-app when it presents, and its buttons
   * and dismiss events fire outside Angular's zone. Clearing `selected` therefore has to
   * re-enter the zone: without a change detection pass the [isOpen] binding never reaches the
   * element, so the modal stays on screen and — worse — Angular still believes it wrote `true`,
   * so opening the next challenge wouldn't re-present it either.
   */
  closeDetails(): void {
    this.zone.run(() => {
      this.selected = null;
    });
  }
}
