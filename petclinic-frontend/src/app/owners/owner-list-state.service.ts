import { Injectable } from '@angular/core';
import { Params } from '@angular/router';

// Session-scoped (in-memory) memory of the last Owners list query params.
// A fresh page load = a fresh service instance => defaults. In-app navigation
// back to /owners restores the remembered params. Not persisted across visits.
@Injectable({ providedIn: 'root' })
export class OwnerListStateService {
  private lastParams: Params | null = null;

  remember(params: Params): void {
    this.lastParams = { ...params };
  }

  get remembered(): Params | null {
    if (this.lastParams === null) {
      return null;
    }
    return { ...this.lastParams };
  }
}
