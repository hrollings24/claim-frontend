import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { ChallengeNewPage } from './challenge-new.page';
import { ChallengeNewPageRoutingModule } from './challenge-new-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ChallengeNewPageRoutingModule],
  declarations: [ChallengeNewPage],
})
export class ChallengeNewPageModule {}
