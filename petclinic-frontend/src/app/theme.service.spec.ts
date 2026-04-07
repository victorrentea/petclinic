import {TestBed} from '@angular/core/testing';
import {ThemeService} from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let listeners: Array<(event: MediaQueryListEvent) => void>;
  let mediaQuery: MediaQueryList;
  let systemPrefersDark: boolean;

  beforeEach(() => {
    listeners = [];
    systemPrefersDark = false;

    mediaQuery = {
      get matches() {
        return systemPrefersDark;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => {
        listeners.push(callback);
      },
      removeEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => {
        listeners = listeners.filter(listener => listener !== callback);
      },
      addListener: () => {
      },
      removeListener: () => {
      },
      dispatchEvent: () => true
    } as MediaQueryList;

    spyOn(window, 'matchMedia').and.returnValue(mediaQuery);
    localStorage.clear();
    document.body.classList.remove('theme-light', 'theme-dark');
    document.documentElement.removeAttribute('data-theme');

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('defaults to system when no preference is stored', () => {
    service.init();

    expect(service.getPreference()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.classList.contains('theme-light')).toBeTrue();
  });

  it('applies dark theme when dark preference is stored', () => {
    localStorage.setItem('petclinic-theme-preference', 'dark');

    service.init();

    expect(service.getPreference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.body.classList.contains('theme-dark')).toBeTrue();
  });

  it('persists selected preference', () => {
    service.init();

    service.setPreference('dark');

    expect(localStorage.getItem('petclinic-theme-preference')).toBe('dark');
  });

  it('follows system mode when OS preference changes', () => {
    service.init();
    systemPrefersDark = true;

    listeners.forEach(listener => listener({matches: true} as MediaQueryListEvent));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.body.classList.contains('theme-dark')).toBeTrue();
  });

  it('ignores OS preference changes when explicit mode is set', () => {
    service.init();
    service.setPreference('light');
    systemPrefersDark = true;

    listeners.forEach(listener => listener({matches: true} as MediaQueryListEvent));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.classList.contains('theme-light')).toBeTrue();
  });
});
