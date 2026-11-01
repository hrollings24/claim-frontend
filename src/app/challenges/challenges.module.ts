import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { LinkPartsPipe } from '../link-parts.pipe';

import { ChallengesPage } from './challenges.page';
import { ChallengesPageRoutingModule } from './challenges-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ChallengesPageRoutingModule, LinkPartsPipe],
  declarations: [ChallengesPage],
})
export class ChallengesPageModule {}
