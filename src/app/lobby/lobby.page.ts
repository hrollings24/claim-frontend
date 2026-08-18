import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Game, GamePlayer, GameService } from '../game.service';

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

  /** Game length as the two fields the lobby shows, kept whole in minutes on the server. */
  durationHours = 1;
  durationMinutesPart = 0;

  readonly hourOptions = Array.from({ length: 24 }, (_, hour) => hour);
  readonly minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5);

  private code = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  /**
   * Only the host can change the length, so once these fields are seeded from the game there
   * is nobody else who could move them underneath the host mid-edit.
   */
  private durationLoaded = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private alerts: AlertController,
  ) {}

  ionViewWillEnter(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.error = null;
    this.durationLoaded = false;
    void this.refresh();
    this.pollHandle = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
  }

  ionViewWillLeave(): void {
    this.stopPolling();
  }

  get canEditDuration(): boolean {
    return this.durationHours * 60 + this.durationMinutesPart > 0;
  }

  teamNameFor(player: GamePlayer): string {
    if (player.teamId === null) {
      return 'No team';
    }

    return this.game?.teams.find((team) => team.id === player.teamId)?.name ?? 'No team';
  }

  memberCount(teamId: string): number {
    return this.game?.players.filter((player) => player.teamId === teamId).length ?? 0;
  }

  formatDuration(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
  }

  async refresh(): Promise<void> {
    // A slow response shouldn't stack up behind the next tick of the poll.
    if (this.refreshing) {
      return;
    }

    this.refreshing = true;
    try {
      this.apply(await this.gameService.get(this.code));
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

  async createTeam(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'New team',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Team name', attributes: { maxlength: 40 } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Create', handler: (data) => void this.submitTeam(data?.name ?? '') },
      ],
    });

    await alert.present();
  }

  joinTeam(teamId: string): Promise<void> {
    return this.act(() => this.gameService.joinTeam(this.code, teamId));
  }

  leaveTeam(): Promise<void> {
    return this.act(() => this.gameService.leaveTeam(this.code));
  }

  saveDuration(): Promise<void> {
    if (!this.canEditDuration) {
      return Promise.resolve();
    }

    const totalMinutes = this.durationHours * 60 + this.durationMinutesPart;

    return this.act(() => this.gameService.setDuration(this.code, totalMinutes));
  }

  start(): Promise<void> {
    return this.act(() => this.gameService.start(this.code));
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

  private submitTeam(rawName: string): Promise<void> {
    const name = rawName.trim();
    if (!name) {
      return Promise.resolve();
    }

    return this.act(() => this.gameService.createTeam(this.code, name));
  }

  /** Every lobby action returns the updated game, so the screen doesn't wait for the next poll. */
  private async act(action: () => Promise<Game>): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.apply(await action());
    } catch (error: unknown) {
      this.error =
        (error as { error?: { title?: string } })?.error?.title ?? 'That did not work.';
    } finally {
      this.busy = false;
    }
  }

  private apply(game: Game): void {
    this.game = game;

    if (!this.durationLoaded) {
      this.durationHours = Math.floor(game.durationMinutes / 60);
      this.durationMinutesPart = game.durationMinutes % 60;
      this.durationLoaded = true;
    }
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}
