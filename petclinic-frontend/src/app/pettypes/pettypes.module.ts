import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {PetTypeService} from './pettype.service';
import {PettypeListComponent} from './pettype-list/pettype-list.component';
import {PettypeAddComponent} from './pettype-add/pettype-add.component';
import {PettypeEditComponent} from './pettype-edit/pettype-edit.component';
import {PettypesRoutingModule} from './pettypes-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    PettypesRoutingModule
  ],
  declarations: [
    PettypeListComponent,
    PettypeAddComponent,
    PettypeEditComponent],
  exports: [
    PettypeListComponent
  ],
  providers: [PetTypeService]
})
export class PetTypesModule {
}
