import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { problemMessage } from '../api-client.service';
import { ChallengeService, ChallengeType } from '../challenge.service';

@Component({
  selector: 'app-challenge-new',
  templateUrl: 'challenge-new.page.html',
  styleUrls: ['challenge-new.page.scss'],
  standalone: false,
})
export class ChallengeNewPage {
  /** Claim cards are played on unclaimed boroughs, steal cards on ones another team holds. */
  type: ChallengeType = 'Claim';

  title = '';
  summary = '';
  furtherDetails = '';

  /** Steal only — how long the countdown runs once a team activates this steal. */
  stealMinutes = 5;

  saving = false;
  loading = false;
  error: string | null = null;

  /** Set when the page was opened to change an existing challenge rather than write a new one. */
  private editingId: string | null = null;

  constructor(
    private challengeService: ChallengeService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  /** Ionic keeps pages alive, so the form is reset on entry rather than left as it was. */
  ionViewWillEnter(): void {
    this.type = 'Claim';
    this.title = '';
    this.summary = '';
    this.furtherDetails = '';
    this.stealMinutes = 5;
    this.error = null;
    this.editingId = this.route.snapshot.paramMap.get('id');

    if (this.editingId !== null) {
      void this.load(this.editingId);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading = true;
    try {
      const challenge = await this.challengeService.get(id);
      this.type = challenge.type;
      this.title = challenge.title;
      this.summary = challenge.summary;
      this.furtherDetails = challenge.furtherDetails;
      this.stealMinutes = challenge.stealMinutes ?? 5;
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not load that challenge.');
    } finally {
      this.loading = false;
    }
  }

  get canSave(): boolean {
    return (
      !this.saving &&
      this.title.trim().length > 0 &&
      this.summary.trim().length > 0 &&
      this.furtherDetails.trim().length > 0
    );
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    this.saving = true;
    this.error = null;
    try {
      const challenge = {
        type: this.type,
        title: this.title.trim(),
        summary: this.summary.trim(),
        furtherDetails: this.furtherDetails.trim(),
        stealMinutes: this.type === 'Steal' ? this.stealMinutes : null,
      };

      await (this.editingId === null
        ? this.challengeService.create(challenge)
        : this.challengeService.update(this.editingId, challenge));

      await this.router.navigateByUrl('/challenges');
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not save the challenge.');
    } finally {
      this.saving = false;
    }
  }
}
