import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import {VisitFormComponent} from './visit-form.component';
import {Visit} from '../visit';

describe('VisitFormComponent', () => {
  let fixture: ComponentFixture<VisitFormComponent>;
  let component: VisitFormComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitFormComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitFormComponent);
    component = fixture.componentInstance;
    component.visit = {description: 'rabies shot'} as Visit;
    component.submitLabel = 'Add Visit';
    fixture.detectChanges();
  });

  function button(label: string): HTMLButtonElement {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    return buttons.find(b => b.textContent.trim() === label);
  }

  it('labels its submit button as told', () => {
    expect(button('Add Visit')).toBeTruthy();
  });

  it('emits back when Back is clicked', () => {
    let backClicked = false;
    component.back.subscribe(() => backClicked = true);

    button('Back').click();

    expect(backClicked).toBeTrue();
  });

  it('emits the form value when submitted', waitForAsync(() => {
    let submitted: Visit;
    component.submitted.subscribe((visit: Visit) => submitted = visit);

    fixture.whenStable().then(() => {
      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      expect(submitted.description).toBe('rabies shot');
    });
  }));
});
