import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSelectModule} from '@angular/material/select';
import {VetListComponent} from './vet-list/vet-list.component';
import {VetService} from './vet.service';
import {VetsRoutingModule} from './vets-routing.module';
import {VetEditComponent} from './vet-edit/vet-edit.component';
import {VetAddComponent} from './vet-add/vet-add.component';
import {VetResolver} from './vet-resolver';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    VetsRoutingModule
  ],
  declarations: [
    VetListComponent,
    VetEditComponent,
    VetAddComponent
  ],
  exports: [
    VetListComponent,
    VetEditComponent,
    VetAddComponent
  ],
  providers: [VetService, VetResolver]
})
export class VetsModule {
}
