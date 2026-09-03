import {Component} from '@angular/core';
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {By} from '@angular/platform-browser';
import {DesignSystemModule} from './design-system.module';

@Component({
  template: `
    <form>
      <app-combo name="type" [required]="required" [(ngModel)]="selected"
        [options]="options" [valueKey]="valueKey" [placeholder]="placeholder"
        inputId="type"></app-combo>
    </form>`
})
class HostComponent {
  options: any[] = [{id: 1, name: 'cat'}, {id: 2, name: 'dog'}];
  valueKey: string | null = null;
  placeholder: string | null = null;
  required = false;
  selected: any = null;
}

describe('ComboComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const select = () => fixture.debugElement.query(By.css('select')).nativeElement as HTMLSelectElement;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [HostComponent],
      imports: [FormsModule, DesignSystemModule]
    }).compileComponents();
  }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('marks its host as a design-system combo', () => {
    const combo = fixture.debugElement.query(By.css('app-combo')).nativeElement as HTMLElement;
    expect(combo.getAttribute('data-ds')).toBe('combo');
  });

  it('renders one option per row, labelled by name', async () => {
    host.valueKey = 'id';
    host.selected = 1;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(Array.from(select().options).map(o => o.text)).toEqual(['cat', 'dog']);
  });

  it('shows a blank entry while the bound value matches no option, as a native select does', () => {
    expect(Array.from(select().options).map(o => o.text)).toEqual(['', 'cat', 'dog']);
    expect(select().selectedIndex).toBe(0);
  });

  it('puts inputId on the inner control so an outer label still points at it', () => {
    expect(select().id).toBe('type');
  });

  it('writes the whole option object back by default', async () => {
    select().value = '1';
    select().dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.selected).toEqual({id: 2, name: 'dog'});
  });

  it('writes only valueKey when one is given', async () => {
    host.valueKey = 'id';
    fixture.detectChanges();
    select().value = '0';
    select().dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.selected).toBe(1);
  });

  it('preselects the bound value', async () => {
    host.valueKey = 'id';
    host.selected = 2;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(select().selectedIndex).toBe(1);
  });

  it('offers a null-valued placeholder when asked', async () => {
    host.placeholder = '-- not assigned --';
    host.valueKey = 'id';
    host.selected = 1;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    select().value = '';
    select().dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(select().options[0].text).toBe('-- not assigned --');
    expect(host.selected).toBeNull();
  });

  it('lets required on the host invalidate the surrounding form', async () => {
    host.required = true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.css('form')).nativeElement as HTMLFormElement;
    expect(form.classList).toContain('ng-invalid');
  });
});
