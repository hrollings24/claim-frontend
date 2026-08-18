import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Game, GameService } from '../game.service';

/**
 * The roster changes rarely (someone joins, someone leaves), so it is polled rather than
 * pushed. Live updates would mean an API Gateway WebSocket API, which is a lot of moving
 * parts for a list that changes every few seconds.
 */
const POLL_INTERVAL_MS = 3000;

@Component({
  selector: 'app-lobby',
  templateUrl: 'lobby.page.html',
  styleUrls: ['lobby.page.scss'],
  standalone: false,
})
export class LobbyPage {
  game: Game | null = null;
  error: string | null = null;
  busy = false;

  private code = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
  ) {}

  ionViewWillEnter(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.error = null;
    void this.refresh();
    this.pollHandle = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
  }

  ionViewWillLeave(): void {
    this.stopPolling();
  }

  async refresh(): Promise<void> {
    // A slow response shouldn't stack up behind the next tick of the poll.
    if (this.refreshing) {
      return;
    }

    this.refreshing = true;
    try {
      this.game = await this.gameService.get(this.code);
    } catch (error: unknown) {
      // 404 is terminal: the last player left, or the lobby expired. Anything else is treated
      // as a blip and left for the next poll to retry.
      if ((error as { status?: number })?.status === 404) {
        this.stopPolling();
        this.game = null;
        this.error = 'This game no longer exists.';
      }
    } finally {
      this.refreshing = false;
    }
  }

  async start(): Promise<void> {
    this.busy = true;
    try {
      this.game = await this.gameService.start(this.code);
    } catch {
      this.error = 'Could not start the game.';
    } finally {
      this.busy = false;
    }
  }

  async leave(): Promise<void> {
    this.busy = true;
    this.stopPolling();
    try {
      await this.gameService.leave(this.code);
    } catch {
      // Leaving is best effort — either way this player is done with the lobby, and an
      // abandoned membership ages out with the game's TTL.
    } finally {
      this.busy = false;
      await this.goHome();
    }
  }

  goHome(): Promise<boolean> {
    return this.router.navigateByUrl('/home');
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}
