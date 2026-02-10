import {VisitsRoutingModule} from './visits-routing.module';
import {CommonModule} from '@angular/common';
import {VisitListComponent} from './visit-list/visit-list.component';
import {VisitEditComponent} from './visit-edit/visit-edit.component';
import {NgModule} from '@angular/core';
import {VisitService} from './visit.service';
import {VisitAddComponent} from './visit-add/visit-add.component';
import {FormsModule} from '@angular/forms';
import {PetsRoutingModule} from '../pets/pets-routing.module';
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
    VisitsRoutingModule,
    PetsRoutingModule
  ],
  declarations: [
    VisitListComponent,
    VisitEditComponent,
    VisitAddComponent
  ],
  exports: [
    VisitListComponent,
    VisitEditComponent,
    VisitAddComponent
  ],
  providers: [
    VisitService,
    {provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE]},
    {provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS}
  ]
})
export class VisitsModule {
}
