import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController, ToastController } from '@ionic/angular';
import { AuthService } from './auth.service';
import { GameService } from './game.service';
import { LastGameService } from './last-game.service';
import { PushService, PushState } from './push.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  user$ = this.authService.user$;
  busy = false;

  pushState: PushState = 'unsupported';

  constructor(
    private authService: AuthService,
    private gameService: GameService,
    private router: Router,
    private menu: MenuController,
    private toasts: ToastController,
    private push: PushService,
    private lastGame: LastGameService,
  ) {
    void this.refreshPushState();
  }

  /** Lets a player who navigated away from the lobby — to Challenges, say — find their way back. */
  get activeGameCode(): string | null {
    return this.lastGame.code;
  }

  async backToGame(): Promise<void> {
    const code = this.activeGameCode;
    if (!code) {
      return;
    }

    await this.menu.close();
    await this.router.navigateByUrl(`/lobby/${code}`);
  }

  get canOfferPush(): boolean {
    return this.pushState !== 'unsupported' && this.pushState !== 'unconfigured';
  }

  get pushBlocked(): boolean {
    return this.pushState === 'blocked';
  }

  async togglePush(enabled: boolean): Promise<void> {
    // Ignore the change the toggle emits when it is first bound to the current state.
    if (enabled === (this.pushState === 'on')) {
      return;
    }

    try {
      this.pushState = enabled ? await this.push.enable() : await this.push.disable();
      if (enabled && this.pushState === 'blocked') {
        await this.notify('Notifications are blocked in your browser settings.');
      }
    } catch {
      this.pushState = 'off';
      await this.notify('Could not change notifications.');
    }
  }

  private async refreshPushState(): Promise<void> {
    try {
      this.pushState = await this.push.state();
    } catch {
      this.pushState = 'unsupported';
    }
  }

  async openChallenges(): Promise<void> {
    await this.menu.close();
    await this.router.navigateByUrl('/challenges');
  }

  async logout(): Promise<void> {
    await this.menu.close();

    try {
      await this.authService.logout();
    } catch {
      await this.notify('Could not log out.');
      return;
    }

    // Route guards only run on navigation, so signing out while sitting on a guarded page
    // would leave the player looking at it until they happened to move.
    await this.router.navigateByUrl('/home');
  }

  async openRules(): Promise<void> {
    await this.menu.close();
    await this.router.navigateByUrl('/rules');
  }

  async createGame(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    await this.menu.close();
    try {
      const game = await this.gameService.create();
      await this.router.navigateByUrl(`/lobby/${game.code}`);
    } catch {
      await this.notify('Could not create a game.');
    } finally {
      this.busy = false;
    }
  }

  async openJoinGame(): Promise<void> {
    await this.menu.close();
    await this.router.navigateByUrl('/join');
  }

  private async notify(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 3000, position: 'bottom' });
    await toast.present();
  }
}
