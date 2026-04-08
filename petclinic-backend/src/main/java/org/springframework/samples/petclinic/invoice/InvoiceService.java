package org.springframework.samples.petclinic.invoice;

import java.math.BigDecimal;
import java.util.List;

public class InvoiceService {

    public BigDecimal calculateTotal(List<Item> items) {
        BigDecimal total = BigDecimal.ZERO; // 🏦 accumulator starts at zero
        for (Item item : items) {
            // 💰 (price - discount) * quantity
            BigDecimal lineTotal = item.price().subtract(item.discount())
                .multiply(BigDecimal.valueOf(item.quantity()));
            total = total.add(lineTotal); // ➕ add line to running total
        }
        return total; // 🧾 grand total
    }
}
