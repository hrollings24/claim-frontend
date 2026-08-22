import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { RulesPage } from './rules.page';
import { RulesPageRoutingModule } from './rules-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, RulesPageRoutingModule],
  declarations: [RulesPage],
})
export class RulesPageModule {}
