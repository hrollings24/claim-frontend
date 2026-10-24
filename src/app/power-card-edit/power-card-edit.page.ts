import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { problemMessage } from '../api-client.service';
import { PowerCardService, SavePowerCard } from '../power-card.service';

@Component({
  selector: 'app-power-card-edit',
  templateUrl: 'power-card-edit.page.html',
  styleUrls: ['power-card-edit.page.scss'],
  standalone: false,
})
export class PowerCardEditPage {
  /** A curse is played on another team; a boost on yourself. */
  kind: SavePowerCard['kind'] = 'Curse';

  title = '';
  description = '';

  saving = false;
  loading = false;
  error: string | null = null;

  /** Set when the page was opened to change an existing card rather than write a new one. */
  private editingId: string | null = null;

  constructor(
    private powerCards: PowerCardService,
    private router: Router,
    private route: ActivatedRoute,
    private alerts: AlertController,
  ) {}

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  get canSave(): boolean {
    return (
      !this.saving &&
      !this.loading &&
      this.title.trim().length > 0 &&
      this.description.trim().length > 0
    );
  }

  /** Ionic keeps pages alive, so the form is reset on entry rather than left as it was. */
  ionViewWillEnter(): void {
    this.kind = 'Curse';
    this.title = '';
    this.description = '';
    this.error = null;
    this.editingId = this.route.snapshot.paramMap.get('id');

    if (this.editingId !== null) {
      void this.load(this.editingId);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading = true;
    try {
      const card = await this.powerCards.get(id);
      this.kind = card.kind === 'Boost' ? 'Boost' : 'Curse';
      this.title = card.title;
      this.description = card.description;
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not load that power card.');
    } finally {
      this.loading = false;
    }
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    this.saving = true;
    this.error = null;
    try {
      const card = { kind: this.kind, title: this.title.trim(), description: this.description.trim() };

      await (this.editingId === null
        ? this.powerCards.create(card)
        : this.powerCards.update(this.editingId, card));

      await this.router.navigateByUrl('/power-cards');
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not save the power card.');
    } finally {
      this.saving = false;
    }
  }

  /** Deleting takes it out of every deck for everyone, so it asks first. */
  async confirmDelete(): Promise<void> {
    const id = this.editingId;
    if (id === null) {
      return;
    }

    const alert = await this.alerts.create({
      header: 'Delete power card',
      message: `"${this.title}" will be removed from every deck. Games already running keep theirs.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => void this.remove(id) },
      ],
    });

    await alert.present();
  }

  private async remove(id: string): Promise<void> {
    try {
      await this.powerCards.remove(id);
      await this.router.navigateByUrl('/power-cards');
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not delete that power card.');
    }
  }
}
