import {NgModule} from '@angular/core';
import {OwnerService} from './owner.service';
import {OwnerListComponent} from './owner-list/owner-list.component';
import {OwnerDetailComponent} from './owner-detail/owner-detail.component';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {OwnerAddComponent} from './owner-add/owner-add.component';
import {OwnerEditComponent} from './owner-edit/owner-edit.component';
import {OwnersRoutingModule} from './owners-routing.module';
import {PetsModule} from '../pets/pets.module';
import {MatTableModule} from '@angular/material/table';
import {MatSortModule} from '@angular/material/sort';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatButtonModule} from '@angular/material/button';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    OwnersRoutingModule,
    PetsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatButtonModule
  ],
  declarations: [
    OwnerListComponent,
    OwnerDetailComponent,
    OwnerEditComponent,
    OwnerAddComponent
  ],
  providers: [OwnerService]

})

export class OwnersModule {
}
