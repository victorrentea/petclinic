package org.springframework.samples.petclinic.invoice;

import java.math.BigDecimal;
import java.util.List;

class InvoiceService {

    BigDecimal total(List<Item> items) {
        return items.stream()
                .map(this::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal lineTotal(Item item) {
        if (item.price().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price cannot be negative");
        }
        if (item.quantity() < 0) {
            throw new IllegalArgumentException("Quantity cannot be negative");
        }
        if (item.discount().compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Discount cannot be greater than 100%");
        }
        BigDecimal multiplier = BigDecimal.ONE.subtract(item.discount());
        return item.price().multiply(BigDecimal.valueOf(item.quantity())).multiply(multiplier);
    }
}
