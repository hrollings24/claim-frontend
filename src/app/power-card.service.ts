import { Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import { PowerKind } from './game.service';

export interface PowerCardDefinition {
  id: string;
  kind: PowerKind;
  title: string;
  description: string;
  /** Curse only: how long it lasts. Null lasts until the cursed team clears it. */
  durationMinutes: number | null;
  /** Steal, Curse Reverse, Fortify and Swap have rules behind them, so nobody can edit or delete them. */
  isBuiltIn: boolean;
}

/** Only Curse or Boost — the rest are built in. */
export interface SavePowerCard {
  kind: 'Curse' | 'Boost';
  title: string;
  description: string;
  /** Kept for a curse only. */
  durationMinutes: number | null;
}

/**
 * The power cards themselves. Anyone may add, edit or delete one; a game copies the wording of
 * its cards when it starts, so changes never reach a game already under way.
 */
@Injectable({ providedIn: 'root' })
export class PowerCardService {
  constructor(private api: ApiClient) {}

  list(): Promise<PowerCardDefinition[]> {
    return this.api.get<PowerCardDefinition[]>('/api/power-cards');
  }

  get(id: string): Promise<PowerCardDefinition> {
    return this.api.get<PowerCardDefinition>(`/api/power-cards/${encodeURIComponent(id)}`);
  }

  create(card: SavePowerCard): Promise<PowerCardDefinition> {
    return this.api.post<PowerCardDefinition>('/api/power-cards', card);
  }

  update(id: string, card: SavePowerCard): Promise<PowerCardDefinition> {
    return this.api.put<PowerCardDefinition>(`/api/power-cards/${encodeURIComponent(id)}`, card);
  }

  remove(id: string): Promise<void> {
    return this.api.delete<void>(`/api/power-cards/${encodeURIComponent(id)}`);
  }
}
