import { Component } from '@angular/core';
import { RefresherCustomEvent } from '@ionic/angular';
import { PowerConfigService, PowerConfiguration } from '../power-config.service';

@Component({
  selector: 'app-power-configs',
  templateUrl: 'power-configs.page.html',
  styleUrls: ['power-configs.page.scss'],
  standalone: false,
})
export class PowerConfigsPage {
  configurations: PowerConfiguration[] = [];
  loading = false;
  error: string | null = null;

  constructor(private powerConfigs: PowerConfigService) {}

  /** Reloads on entry so a configuration just saved on the next screen appears on the way back. */
  ionViewWillEnter(): void {
    void this.reload();
  }

  async reload(event?: RefresherCustomEvent): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.configurations = await this.powerConfigs.list();
    } catch {
      this.error = 'Could not load power card configurations.';
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
