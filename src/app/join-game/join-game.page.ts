import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Game, GameService, GameStatus, joinFailureMessage } from '../game.service';

@Component({
  selector: 'app-join-game',
  templateUrl: 'join-game.page.html',
  styleUrls: ['join-game.page.scss'],
  standalone: false,
})
export class JoinGamePage {
  /** Games the account still has a seat in, fetched fresh on every visit. */
  mine: Game[] = [];
  loading = false;

  code = '';
  joining = false;
  error: string | null = null;

  constructor(
    private gameService: GameService,
    private router: Router,
  ) {}

  ionViewWillEnter(): void {
    this.code = '';
    this.error = null;
    void this.loadMine();
  }

  private async loadMine(): Promise<void> {
    this.loading = true;
    try {
      this.mine = await this.gameService.mine();
    } catch {
      // The code field below still works even if this listing fails to load.
      this.mine = [];
    } finally {
      this.loading = false;
    }
  }

  statusLabel(status: GameStatus): string {
    switch (status) {
      case 'InProgress':
        return 'In play';
      case 'Finished':
        return 'Game over';
      default:
        return 'Waiting room';
    }
  }

  get canJoin(): boolean {
    return !this.joining && this.code.trim().length > 0;
  }

  async join(): Promise<void> {
    if (!this.canJoin) {
      return;
    }

    this.joining = true;
    this.error = null;
    try {
      const game = await this.gameService.join(this.code.trim().toUpperCase());
      await this.router.navigateByUrl(`/lobby/${game.code}`);
    } catch (error: unknown) {
      this.error = joinFailureMessage(error);
    } finally {
      this.joining = false;
    }
  }
}
