import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {OwnerDetailComponent} from './owner-detail/owner-detail.component';
import {OwnerListComponent} from './owner-list/owner-list.component';
import {OwnerEditComponent} from './owner-edit/owner-edit.component';
import {OwnerAddComponent} from './owner-add/owner-add.component';
import {PetAddComponent} from '../pets/pet-add/pet-add.component';

const ownerRoutes: Routes = [
  {path: 'owners', component: OwnerListComponent},
  {path: 'owners/add', component: OwnerAddComponent},
  {path: 'owners/:id', component: OwnerDetailComponent},
  {path: 'owners/:id/edit', component: OwnerEditComponent},
  {path: 'owners/:id/pets/add', component: PetAddComponent}
];

@NgModule({
  imports: [RouterModule.forChild(ownerRoutes)],
  exports: [RouterModule]
})

export class OwnersRoutingModule {
}
