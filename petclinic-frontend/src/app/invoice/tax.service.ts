import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TaxService {

  applyVat(value: number): number {
    return Math.round(value * 1.19 * 100) / 100;
  }
}
