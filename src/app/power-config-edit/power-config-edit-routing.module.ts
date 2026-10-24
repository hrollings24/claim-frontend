import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PowerConfigEditPage } from './power-config-edit.page';

const routes: Routes = [
  {
    path: '',
    component: PowerConfigEditPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PowerConfigEditPageRoutingModule {}
