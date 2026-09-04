import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import {MatDatepickerModule} from '@angular/material/datepicker';
import * as moment from 'moment';

import {VisitFieldsComponent} from './visit-fields.component';
import {Visit} from '../visit';

// The component takes its ControlContainer from the surrounding NgForm, so it can only
// be built inside a form — the same way both visit pages use it.
@Component({
  template: `
    <form #visitForm="ngForm">
      <app-visit-fields [visit]="visit" [petBirthDate]="petBirthDate"></app-visit-fields>
    </form>`
})
class HostComponent {
  @ViewChild(VisitFieldsComponent) fields: VisitFieldsComponent;
  visit: Visit = {} as Visit;
  petBirthDate: string;
}

describe('VisitFieldsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitFieldsComponent, HostComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('bounds the date by the pet birth date and one year ahead', () => {
    host.petBirthDate = '2018-08-06';
    fixture.detectChanges();

    expect(host.fields.minDate.format('YYYY-MM-DD')).toBe('2018-08-06');
    expect(host.fields.maxDate.format('YYYY-MM-DD'))
      .toBe(moment().add(1, 'year').format('YYYY-MM-DD'));
  });

  it('leaves the lower bound open while the pet is still loading', () => {
    fixture.detectChanges();

    expect(host.fields.minDate).toBeNull();
  });

  it('registers its controls in the surrounding form', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[name="date"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input#description')).toBeTruthy();
  });
});
