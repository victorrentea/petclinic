import {NgModule} from '@angular/core';
import {OwnerService} from './owner.service';
import {OwnerListComponent} from './owner-list/owner-list.component';
import {OwnerPagerComponent} from './owner-pager/owner-pager.component';
import {OwnerDetailComponent} from './owner-detail/owner-detail.component';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {OwnerAddComponent} from './owner-add/owner-add.component';
import {OwnerEditComponent} from './owner-edit/owner-edit.component';
import {OwnersRoutingModule} from './owners-routing.module';
import {PetsModule} from '../pets/pets.module';
import {MatSortModule} from '@angular/material/sort';
import {DesignSystemModule} from '../design-system/design-system.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    OwnersRoutingModule,
    PetsModule,
    MatSortModule,
    DesignSystemModule
  ],
  declarations: [
    OwnerListComponent,
    OwnerPagerComponent,
    OwnerDetailComponent,
    OwnerEditComponent,
    OwnerAddComponent
  ],
  providers: [OwnerService]

})

export class OwnersModule {
}
