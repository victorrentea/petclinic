import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SpecialtyService} from './specialty.service';
import {SpecialtyListComponent} from './specialty-list/specialty-list.component';
import {SpecialtiesRoutingModule} from './specialties-routing.module';
import {SpecialtyAddComponent} from './specialty-add/specialty-add.component';
import {SpecialtyEditComponent} from './specialty-edit/specialty-edit.component';
import {SpecResolver} from './spec-resolver';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    SpecialtiesRoutingModule
  ],
  declarations: [
    SpecialtyListComponent,
    SpecialtyAddComponent,
    SpecialtyEditComponent
  ],
  exports: [
    SpecialtyListComponent
  ],
  providers: [SpecialtyService, SpecResolver]
})
export class SpecialtiesModule {
}
