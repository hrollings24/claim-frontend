import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { authGuard } from './auth.guard';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'lobby/:code',
    canActivate: [authGuard],
    loadChildren: () => import('./lobby/lobby.module').then( m => m.LobbyPageModule)
  },
  {
    path: 'join',
    canActivate: [authGuard],
    loadChildren: () => import('./join-game/join-game.module').then( m => m.JoinGamePageModule)
  },
  {
    path: 'rules',
    loadChildren: () => import('./rules/rules.module').then( m => m.RulesPageModule)
  },
  {
    path: 'challenges/new',
    canActivate: [authGuard],
    loadChildren: () => import('./challenge-new/challenge-new.module').then( m => m.ChallengeNewPageModule)
  },
  {
    path: 'challenges/:id/edit',
    canActivate: [authGuard],
    loadChildren: () => import('./challenge-new/challenge-new.module').then( m => m.ChallengeNewPageModule)
  },
  {
    path: 'challenges',
    canActivate: [authGuard],
    loadChildren: () => import('./challenges/challenges.module').then( m => m.ChallengesPageModule)
  },
  {
    path: 'power-cards/cards/new',
    canActivate: [authGuard],
    loadChildren: () => import('./power-card-edit/power-card-edit.module').then( m => m.PowerCardEditPageModule)
  },
  {
    path: 'power-cards/cards/:id/edit',
    canActivate: [authGuard],
    loadChildren: () => import('./power-card-edit/power-card-edit.module').then( m => m.PowerCardEditPageModule)
  },
  {
    path: 'power-cards/new',
    canActivate: [authGuard],
    loadChildren: () => import('./power-config-edit/power-config-edit.module').then( m => m.PowerConfigEditPageModule)
  },
  {
    path: 'power-cards/:id/edit',
    canActivate: [authGuard],
    loadChildren: () => import('./power-config-edit/power-config-edit.module').then( m => m.PowerConfigEditPageModule)
  },
  {
    path: 'power-cards',
    canActivate: [authGuard],
    loadChildren: () => import('./power-configs/power-configs.module').then( m => m.PowerConfigsPageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
