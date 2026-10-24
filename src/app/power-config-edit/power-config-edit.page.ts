import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { problemMessage } from '../api-client.service';
import { PowerKind, powerKindColor } from '../game.service';
import { MAX_POWER_COPIES, PowerConfigService, PowerCount } from '../power-config.service';

@Component({
  selector: 'app-power-config-edit',
  templateUrl: 'power-config-edit.page.html',
  styleUrls: ['power-config-edit.page.scss'],
  standalone: false,
})
export class PowerConfigEditPage {
  name = '';

  /** Every card the game knows, with how many of it this deck holds. */
  cards: PowerCount[] = [];

  readonly maxCopies = MAX_POWER_COPIES;

  readonly kindColor: (kind: PowerKind) => string = powerKindColor;

  saving = false;
  loading = false;
  error: string | null = null;

  /** Set when the page was opened to change an existing configuration rather than create one. */
  private editingId: string | null = null;

  constructor(
    private powerConfigs: PowerConfigService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  get totalCards(): number {
    return this.cards.reduce((total, card) => total + card.count, 0);
  }

  get canSave(): boolean {
    return !this.saving && !this.loading && this.name.trim().length > 0 && this.totalCards > 0;
  }

  /** Ionic keeps pages alive, so the form is reset on entry rather than left as it was. */
  ionViewWillEnter(): void {
    this.name = '';
    this.cards = [];
    this.error = null;
    this.editingId = this.route.snapshot.paramMap.get('id');
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      if (this.editingId === null) {
        this.cards = await this.powerConfigs.cards();
      } else {
        const configuration = await this.powerConfigs.get(this.editingId);
        this.name = configuration.name;
        this.cards = configuration.cards;
      }
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not load the power cards.');
    } finally {
      this.loading = false;
    }
  }

  change(card: PowerCount, by: number): void {
    card.count = Math.min(this.maxCopies, Math.max(0, card.count + by));
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    this.saving = true;
    this.error = null;
    try {
      const configuration = {
        name: this.name.trim(),
        counts: this.cards.reduce<Record<string, number>>(
          (counts, card) => ({ ...counts, [card.powerId]: card.count }),
          {},
        ),
      };

      await (this.editingId === null
        ? this.powerConfigs.create(configuration)
        : this.powerConfigs.update(this.editingId, configuration));

      await this.router.navigateByUrl('/power-cards');
    } catch (error: unknown) {
      this.error = problemMessage(error, 'Could not save the configuration.');
    } finally {
      this.saving = false;
    }
  }
}
