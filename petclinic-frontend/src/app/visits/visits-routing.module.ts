import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {VisitsPageComponent} from './visits-page/visits-page.component';
import {VisitEditComponent} from './visit-edit/visit-edit.component';

const visitRoutes: Routes = [
  {path: 'visits', component: VisitsPageComponent},
  {path: 'visits/:id/edit', component: VisitEditComponent},
];

@NgModule({
  imports: [RouterModule.forChild(visitRoutes)],
  exports: [RouterModule],
})
export class VisitsRoutingModule {
}
