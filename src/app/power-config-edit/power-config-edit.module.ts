import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { PowerConfigEditPage } from './power-config-edit.page';
import { PowerConfigEditPageRoutingModule } from './power-config-edit-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PowerConfigEditPageRoutingModule],
  declarations: [PowerConfigEditPage],
})
export class PowerConfigEditPageModule {}
