package org.springframework.samples.petclinic.invoice;

import java.math.BigDecimal;
import java.util.List;

public class InvoiceService {

    public BigDecimal calculateTotal(List<Item> items) {
        return items.stream()
            .map(this::lineTotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal lineTotal(Item item) {
        if (item.discount().compareTo(item.price()) > 0) {
            throw new IllegalArgumentException(
                "Discount %s exceeds price %s for item '%s'".formatted(item.discount(), item.price(), item.name()));
        }
        return item.price().subtract(item.discount()).multiply(BigDecimal.valueOf(item.quantity()));
    }
}
