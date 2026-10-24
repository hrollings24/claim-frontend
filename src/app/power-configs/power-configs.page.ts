import { Component } from '@angular/core';
import { RefresherCustomEvent } from '@ionic/angular';
import { PowerKind, powerKindColor } from '../game.service';
import { PowerCardDefinition, PowerCardService } from '../power-card.service';
import { PowerConfigService, PowerConfiguration } from '../power-config.service';

/** Decks are the configurations a host picks from; cards are what go in them. */
export type PowerTab = 'Decks' | 'Cards';

@Component({
  selector: 'app-power-configs',
  templateUrl: 'power-configs.page.html',
  styleUrls: ['power-configs.page.scss'],
  standalone: false,
})
export class PowerConfigsPage {
  tab: PowerTab = 'Decks';

  configurations: PowerConfiguration[] = [];
  cards: PowerCardDefinition[] = [];
  loading = false;
  error: string | null = null;

  readonly kindColor: (kind: PowerKind) => string = powerKindColor;

  constructor(
    private powerConfigs: PowerConfigService,
    private powerCards: PowerCardService,
  ) {}

  /** Reloads on entry so something just saved on the next screen appears on the way back. */
  ionViewWillEnter(): void {
    void this.reload();
  }

  get addLink(): string {
    return this.tab === 'Decks' ? '/power-cards/new' : '/power-cards/cards/new';
  }

  async reload(event?: RefresherCustomEvent): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      [this.configurations, this.cards] = await Promise.all([
        this.powerConfigs.list(),
        this.powerCards.list(),
      ]);
    } catch {
      this.error = 'Could not load power cards.';
    } finally {
      this.loading = false;
      await event?.target.complete();
    }
  }

  /** "5 Steal · 2 No tube" — only the cards actually in the deck. */
  describe(configuration: PowerConfiguration): string {
    return configuration.cards
      .filter(card => card.count > 0)
      .map(card => `${card.count} ${card.title}`)
      .join(' · ');
  }
}
