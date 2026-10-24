import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PowerConfigsPage } from './power-configs.page';

const routes: Routes = [
  {
    path: '',
    component: PowerConfigsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PowerConfigsPageRoutingModule {}
