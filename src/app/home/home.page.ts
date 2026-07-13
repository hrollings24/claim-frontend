import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import { ApiService } from '../api.service';

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

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
  ) {}

  login(): void {
    this.authService.login();
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
