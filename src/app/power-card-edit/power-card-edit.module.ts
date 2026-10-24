import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { PowerCardEditPage } from './power-card-edit.page';
import { PowerCardEditPageRoutingModule } from './power-card-edit-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PowerCardEditPageRoutingModule],
  declarations: [PowerCardEditPage],
})
export class PowerCardEditPageModule {}
