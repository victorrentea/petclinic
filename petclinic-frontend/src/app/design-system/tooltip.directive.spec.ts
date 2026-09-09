import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TooltipDirective } from './tooltip.directive';
import { TooltipService } from './tooltip.service';

@Component({
  template: `
    <button id="fixed" data-tip="A fixed string">fixed</button>
    <button id="bound" [data-tip]="tip">bound</button>
  `,
})
class HostComponent {
  tip = 'Potter, Harry';
}

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  const attr = (id: string) =>
    (fixture.nativeElement.querySelector(id) as HTMLElement).getAttribute('data-tip');

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HostComponent, TooltipDirective],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  // Karma runs every spec in one browser, and the service listens on `document`.
  // Left alive, this spec's instance would answer hovers raised by the next one.
  afterEach(() => TestBed.inject(TooltipService).ngOnDestroy());

  it('applies the directive to every element carrying data-tip', () => {
    expect(fixture.debugElement.queryAll(By.directive(TooltipDirective)).length).toBe(2);
  });

  it('keeps a bound tip in sync with its expression', () => {
    expect(attr('#bound')).toBe('Potter, Harry');

    fixture.componentInstance.tip = 'Śliwiński, Salazar';
    fixture.detectChanges();

    expect(attr('#bound')).toBe('Śliwiński, Salazar');
  });

  it('leaves a fixed tip alone', () => {
    expect(attr('#fixed')).toBe('A fixed string');
  });

  it('renders an absent tip as empty rather than as "undefined"', () => {
    fixture.componentInstance.tip = undefined as unknown as string;
    fixture.detectChanges();

    expect(attr('#bound')).toBe('');
  });

  it('starts the one shared service', () => {
    expect(TestBed.inject(TooltipService)).toBeTruthy();
  });
});
