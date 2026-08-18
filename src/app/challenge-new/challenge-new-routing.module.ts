import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChallengeNewPage } from './challenge-new.page';

const routes: Routes = [
  {
    path: '',
    component: ChallengeNewPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChallengeNewPageRoutingModule {}
