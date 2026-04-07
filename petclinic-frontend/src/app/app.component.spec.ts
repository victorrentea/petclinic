/* tslint:disable:no-unused-variable */

import {TestBed, waitForAsync} from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppComponent} from './app.component';
import {ThemeService} from './theme.service';

describe('AppComponent', () => {
  let themeServiceSpy: jasmine.SpyObj<ThemeService>;

  beforeEach(waitForAsync(() => {
    themeServiceSpy = jasmine.createSpyObj('ThemeService', ['init', 'getPreference', 'setPreference']);
    themeServiceSpy.getPreference.and.returnValue('system');

    TestBed.configureTestingModule({
      declarations: [
        AppComponent
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [{provide: ThemeService, useValue: themeServiceSpy}]
    }).compileComponents();
  }));

  it('should create the app', waitForAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;

    expect(app).toBeTruthy();
  }));

  it('initializes theme preference from ThemeService', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(themeServiceSpy.init).toHaveBeenCalled();
    expect(themeServiceSpy.getPreference).toHaveBeenCalled();
    expect(fixture.componentInstance.themePreference).toBe('system');
  });

  it('updates theme preference on user selection', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    fixture.componentInstance.onThemePreferenceChange('dark');

    expect(themeServiceSpy.setPreference).toHaveBeenCalledWith('dark');
    expect(fixture.componentInstance.themePreference).toBe('dark');
  });
});
