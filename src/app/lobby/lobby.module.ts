import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { LobbyPage } from './lobby.page';
import { LobbyPageRoutingModule } from './lobby-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, LobbyPageRoutingModule],
  declarations: [LobbyPage],
})
export class LobbyPageModule {}
