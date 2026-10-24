import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import { PowerKind } from './game.service';

/** One row per card the game knows, zeros included. */
export interface PowerCount {
  powerId: string;
  kind: PowerKind;
  title: string;
  description: string;
  count: number;
}

/**
 * A named recipe for a game's power deck. Shared by everyone and editable by anyone; a game
 * copies it when it starts, so editing one never changes a game in progress.
 */
export interface PowerConfiguration {
  id: string;
  name: string;
  cards: PowerCount[];
  totalCards: number;
}

/** Power card id to copies. Replaces the whole set, so a card left out counts as zero. */
export interface SavePowerConfiguration {
  name: string;
  counts: Record<string, number>;
}

/** The server's ceiling on any one card. */
export const MAX_POWER_COPIES = 50;

@Injectable({ providedIn: 'root' })
export class PowerConfigService {
  constructor(private api: ApiClient) {}

  /** Every configuration, alphabetically. */
  list(): Promise<PowerConfiguration[]> {
    return this.api.get<PowerConfiguration[]>('/api/power-configurations');
  }

  /** Every card a configuration can include, all at zero — the starting point for a new one. */
  cards(): Promise<PowerCount[]> {
    return this.api.get<PowerCount[]>('/api/power-configurations/cards');
  }

  get(id: string): Promise<PowerConfiguration> {
    return this.api.get<PowerConfiguration>(`/api/power-configurations/${encodeURIComponent(id)}`);
  }

  create(configuration: SavePowerConfiguration): Promise<PowerConfiguration> {
    return this.api.post<PowerConfiguration>('/api/power-configurations', configuration);
  }

  update(id: string, configuration: SavePowerConfiguration): Promise<PowerConfiguration> {
    return this.api.put<PowerConfiguration>(
      `/api/power-configurations/${encodeURIComponent(id)}`,
      configuration,
    );
  }
}
