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
import {MatPaginatorIntl, MatPaginatorModule} from '@angular/material/paginator';
import {ownersPaginatorIntl} from './owner-paginator-intl';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    OwnersRoutingModule,
    PetsModule,
    MatPaginatorModule
  ],
  declarations: [
    OwnerListComponent,
    OwnerDetailComponent,
    OwnerEditComponent,
    OwnerAddComponent
  ],
  providers: [
    OwnerService,
    {provide: MatPaginatorIntl, useFactory: ownersPaginatorIntl}
  ]

})

export class OwnersModule {
}
