import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, MenuController, ToastController } from '@ionic/angular';
import { AuthService } from './auth.service';
import { GameService, joinFailureMessage } from './game.service';
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
    private alerts: AlertController,
    private toasts: ToastController,
    private push: PushService,
  ) {
    void this.refreshPushState();
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

  /**
   * The menu is reachable from any screen, so joining asks for the code here rather than
   * sending the player back to the home screen to type it.
   */
  async joinGame(): Promise<void> {
    await this.menu.close();

    const alert = await this.alerts.create({
      header: 'Join game',
      inputs: [
        {
          name: 'code',
          type: 'text',
          placeholder: 'Game code',
          attributes: { maxlength: 6, autocapitalize: 'characters' },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Join', handler: (data) => void this.join(data?.code ?? '') },
      ],
    });

    await alert.present();
  }

  private async join(rawCode: string): Promise<void> {
    const code = rawCode.trim().toUpperCase();
    if (!code || this.busy) {
      return;
    }

    this.busy = true;
    try {
      const game = await this.gameService.join(code);
      await this.router.navigateByUrl(`/lobby/${game.code}`);
    } catch (error: unknown) {
      await this.notify(joinFailureMessage(error));
    } finally {
      this.busy = false;
    }
  }

  private async notify(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 3000, position: 'bottom' });
    await toast.present();
  }
}
