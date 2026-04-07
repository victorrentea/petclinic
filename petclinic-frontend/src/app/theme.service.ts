import {DOCUMENT} from '@angular/common';
import {Inject, Injectable} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

@Injectable({providedIn: 'root'})
export class ThemeService {
  private static readonly STORAGE_KEY = 'petclinic-theme-preference';

  private mediaQuery: MediaQueryList;
  private listener: ((event: MediaQueryListEvent) => void) | null = null;
  private preference: ThemePreference = 'system';

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  init(): void {
    this.preference = this.readStoredPreference();
    this.applyPreference(this.preference);
    this.attachSystemListener();
  }

  getPreference(): ThemePreference {
    return this.preference;
  }

  setPreference(preference: ThemePreference): void {
    this.preference = preference;
    localStorage.setItem(ThemeService.STORAGE_KEY, preference);
    this.applyPreference(preference);
  }

  private readStoredPreference(): ThemePreference {
    const stored = localStorage.getItem(ThemeService.STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private applyPreference(preference: ThemePreference): void {
    const resolvedTheme = this.resolveTheme(preference);
    const body = this.document.body;

    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light');

    this.document.documentElement.setAttribute('data-theme', resolvedTheme);
    this.document.documentElement.style.setProperty('color-scheme', resolvedTheme);
  }

  private resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference === 'system') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return preference;
  }

  private attachSystemListener(): void {
    if (this.listener) {
      this.detachSystemListener();
    }

    this.listener = () => {
      if (this.preference === 'system') {
        this.applyPreference('system');
      }
    };

    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', this.listener);
      return;
    }

    if (this.mediaQuery.addListener) {
      this.mediaQuery.addListener(this.listener);
    }
  }

  private detachSystemListener(): void {
    if (!this.listener) {
      return;
    }

    if (this.mediaQuery.removeEventListener) {
      this.mediaQuery.removeEventListener('change', this.listener);
      this.listener = null;
      return;
    }

    if (this.mediaQuery.removeListener) {
      this.mediaQuery.removeListener(this.listener);
    }

    this.listener = null;
  }
}

