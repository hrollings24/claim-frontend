import { Injectable } from '@angular/core';

const STORAGE_KEY = 'activeGameCode';

/**
 * Remembers which game a player is currently in. The lobby route holds nothing once its
 * component is destroyed, so without this a player who navigates away — to the menu's
 * Challenges page, say — has no way back to a game they never actually left.
 */
@Injectable({ providedIn: 'root' })
export class LastGameService {
  get code(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }

  set(code: string): void {
    localStorage.setItem(STORAGE_KEY, code);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
