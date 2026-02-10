import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {PettypeListComponent} from './pettype-list/pettype-list.component';
import {PettypeAddComponent} from './pettype-add/pettype-add.component';
import {PettypeEditComponent} from './pettype-edit/pettype-edit.component';

const pettypesRoutes: Routes = [
  {path: 'pettypes', component: PettypeListComponent},
  {path: 'pettypes/add', component: PettypeAddComponent},
  {path: 'pettypes/:id/edit', component: PettypeEditComponent}
];

@NgModule({
  imports: [RouterModule.forChild(pettypesRoutes)],
  exports: [RouterModule]
})

export class PettypesRoutingModule {
}
