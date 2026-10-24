import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { PowerConfigsPage } from './power-configs.page';
import { PowerConfigsPageRoutingModule } from './power-configs-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, PowerConfigsPageRoutingModule],
  declarations: [PowerConfigsPage],
})
export class PowerConfigsPageModule {}
