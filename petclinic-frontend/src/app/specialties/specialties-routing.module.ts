import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {SpecialtyListComponent} from './specialty-list/specialty-list.component';
import {SpecialtyEditComponent} from './specialty-edit/specialty-edit.component';

const specialtyRoutes: Routes = [
  {path: 'specialties', component: SpecialtyListComponent},
  // {path: 'specialties/add', component: SpecialtyAddComponent},
  // {path: 'specialties/:id', component: SpecialtyDetailComponent},
   {path: 'specialties/:id/edit', component: SpecialtyEditComponent}
];

@NgModule({
  imports: [RouterModule.forChild(specialtyRoutes)],
  exports: [RouterModule]
})

export class SpecialtiesRoutingModule {
}
