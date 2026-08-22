import { Component } from '@angular/core';

@Component({
  selector: 'app-rules',
  templateUrl: 'rules.page.html',
  styleUrls: ['rules.page.scss'],
  standalone: false,
})
export class RulesPage {
  /**
   * The numbers the engine actually runs on (see GamesOptions in the API). Held here so the
   * page states them once rather than repeating them through the prose.
   */
  readonly activeBoroughs = 6;
  readonly handSize = 5;
  readonly hotBonus = 1;
  readonly hotRotation = '90 minutes';
  readonly counterWindow = '15 minutes';
  readonly boroughCount = 32;
}
