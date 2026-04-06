package org.springframework.samples.petclinic.invoice;

import java.math.BigDecimal;
import java.util.List;

class InvoiceService {

    BigDecimal calculateTotal(List<Item> items) {
        return items.stream()
            .map(item -> item.price()
                .subtract(item.discount())
                .multiply(BigDecimal.valueOf(item.quantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
