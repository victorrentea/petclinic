import { Injectable } from '@angular/core';
import { Item } from './item.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {

  calculateTotal(items: Item[]): number {
    // TODO
    return 0;
  }
}
