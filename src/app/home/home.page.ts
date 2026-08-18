import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ApiService } from '../api.service';
import { GameService, joinFailureMessage } from '../game.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  user$ = this.authService.user$;
  apiResponse: string | null = null;
  apiError: string | null = null;

  joinCode = '';
  busy = false;
  gameError: string | null = null;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private gameService: GameService,
    private router: Router,
  ) {}

  login(): void {
    this.authService.login();
  }

  async createGame(): Promise<void> {
    this.busy = true;
    this.gameError = null;
    try {
      const game = await this.gameService.create();
      await this.router.navigateByUrl(`/lobby/${game.code}`);
    } catch {
      this.gameError = 'Could not create a game.';
    } finally {
      this.busy = false;
    }
  }

  async joinGame(): Promise<void> {
    const code = this.joinCode.trim().toUpperCase();
    if (!code) {
      return;
    }

    this.busy = true;
    this.gameError = null;
    try {
      const game = await this.gameService.join(code);
      await this.router.navigateByUrl(`/lobby/${game.code}`);
    } catch (error: unknown) {
      this.gameError = joinFailureMessage(error);
    } finally {
      this.busy = false;
    }
  }

  async callHello(): Promise<void> {
    this.apiResponse = null;
    this.apiError = null;
    try {
      this.apiResponse = await this.apiService.hello();
    } catch {
      this.apiError = 'Failed to call the API.';
    }
  }
}
