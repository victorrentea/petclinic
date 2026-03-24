import { InvoiceService } from './invoice.service';
import { Item } from './item.model';

describe('InvoiceService', () => {
  const service = new InvoiceService();

  it('should return zero for empty list', () => {
    expect(service.calculateTotal([])).toBeCloseTo(0.00, 2);
  });

  it('should multiply price by quantity', () => {
    const items: Item[] = [
      { name: 'Book', price: 10.00, quantity: 3, discount: 0 }
    ];

    expect(service.calculateTotal(items)).toBeCloseTo(30.00, 2);
  });

  it('should apply discount per item', () => {
    const items: Item[] = [
      { name: 'Book', price: 10.00, quantity: 2, discount: 0.10 }
    ];

    expect(service.calculateTotal(items)).toBeCloseTo(18.00, 2);
  });
});
