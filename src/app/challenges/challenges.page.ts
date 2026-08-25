import { Component, NgZone, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonItemSliding, IonModal, RefresherCustomEvent } from '@ionic/angular';
import { problemMessage } from '../api-client.service';
import { Challenge, ChallengeService, ChallengeType } from '../challenge.service';

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

  @ViewChild(IonModal) private detailsModal?: IonModal;

  loading = false;
  error: string | null = null;

  /** Which half of the deck to show. Filtering happens here because the list is already whole. */
  filter: ChallengeType | 'All' = 'All';

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

  get visible(): Challenge[] {
    return this.filter === 'All'
      ? this.challenges
      : this.challenges.filter(challenge => challenge.type === this.filter);
  }

  /** True when there are challenges, but none of the kind currently being shown. */
  get filteredEverythingOut(): boolean {
    return this.challenges.length > 0 && this.visible.length === 0;
  }

  async reload(event?: RefresherCustomEvent): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.challenges = await this.challengeService.list();
    } catch {
      this.error = 'Could not load challenges.';
    } finally {
      this.loading = false;
      await event?.target.complete();
    }
  }

  async edit(challenge: Challenge, slider?: IonItemSliding): Promise<void> {
    // Left open, the row stays swiped when the page is returned to.
    await slider?.close();

    // Ionic moves the modal out of this page when it presents, so its buttons fire outside
    // Angular's zone. A navigation started out there happens but is never rendered.
    //
    // Dismissing has to be awaited rather than left to the [isOpen] binding: navigating detaches
    // this page before change detection acts on it, so the modal would stay on screen over the
    // page it navigated to — which looks exactly like the button having done nothing.
    await this.dismissDetails();
    await this.inZone(() => this.router.navigateByUrl(`/challenges/${challenge.id}/edit`));
  }

  /** Closes the details modal and waits for it to actually be gone. */
  private async dismissDetails(): Promise<void> {
    await this.detailsModal?.dismiss();
    await this.inZone(async () => {
      this.selected = null;
    });
  }

  /** Removing a challenge takes it out of the deck for everyone, so it asks first. */
  async confirmDelete(challenge: Challenge, slider?: IonItemSliding): Promise<void> {
    await slider?.close();

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
    // Same reason as edit: this can be reached from the modal, where nothing runs in the zone,
    // so dropping the row from the list would never reach the screen.
    await this.dismissDetails();

    await this.inZone(async () => {
      try {
        await this.challengeService.remove(challenge.id);
        this.challenges = this.challenges.filter(c => c.id !== challenge.id);
      } catch (error: unknown) {
        this.error = problemMessage(error, 'Could not delete that challenge.');
      }
    });
  }

  /**
   * Runs work inside Angular's zone whether or not the caller was already in it. Everything the
   * details modal can trigger has to go through here: its buttons fire from outside, and state
   * changed out there is never rendered.
   */
  private inZone<T>(work: () => Promise<T>): Promise<T> {
    return this.zone.run(work);
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
