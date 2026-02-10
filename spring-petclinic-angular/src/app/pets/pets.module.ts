import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PetsRoutingModule} from './pets-routing.module';
import {PetListComponent} from './pet-list/pet-list.component';
import {PetService} from './pet.service';
import {VisitsModule} from '../visits/visits.module';
import {PetEditComponent} from './pet-edit/pet-edit.component';
import {FormsModule} from '@angular/forms';
import {PetAddComponent} from './pet-add/pet-add.component';

import {MatMomentDateModule, MomentDateAdapter} from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from '@angular/material/core';

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'YYYY/MM/DD',
  },
  display: {
    dateInput: 'YYYY/MM/DD',
    monthYearLabel: 'MM YYYY',
    dateA11yLabel: 'YYYY/MM/DD',
    monthYearA11yLabel: 'MM YYYY',
  },
};


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatMomentDateModule,
    PetsRoutingModule,
    VisitsModule
  ],
  declarations: [
    PetListComponent,
    PetEditComponent,
    PetAddComponent
  ],
  exports: [
    PetListComponent,
    PetEditComponent,
    PetAddComponent
  ],
  providers: [
    PetService,
    {provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE]},
    {provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS}
  ]
})
export class PetsModule {
}


