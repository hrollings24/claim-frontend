import { Component } from '@angular/core';
import { Router } from '@angular/router';
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

  saving = false;
  error: string | null = null;

  constructor(
    private challengeService: ChallengeService,
    private router: Router,
  ) {}

  /** Ionic keeps pages alive, so the form is cleared on entry rather than left as it was. */
  ionViewWillEnter(): void {
    this.type = 'Claim';
    this.title = '';
    this.summary = '';
    this.furtherDetails = '';
    this.error = null;
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
      await this.challengeService.create({
        type: this.type,
        title: this.title.trim(),
        summary: this.summary.trim(),
        furtherDetails: this.furtherDetails.trim(),
      });

      await this.router.navigateByUrl('/challenges');
    } catch (error: unknown) {
      this.error =
        (error as { error?: { title?: string } })?.error?.title ?? 'Could not save the challenge.';
    } finally {
      this.saving = false;
    }
  }
}
