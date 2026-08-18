import { Component } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  user$ = this.authService.user$;

  constructor(private authService: AuthService) {}

  login(): void {
    this.authService.login();
  }
}
