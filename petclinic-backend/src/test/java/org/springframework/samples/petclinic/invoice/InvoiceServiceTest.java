package org.springframework.samples.petclinic.invoice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceServiceTest {

    private final InvoiceService service = new InvoiceService();

    @Test
    void shouldReturnZeroForEmptyList() {
        assertThat(service.calculateTotal(List.of()))
            .isEqualByComparingTo("0.00");
    }

    @Test
    void shouldMultiplyPriceByQuantity() {
        var items = List.of(
            new Item("Book", new BigDecimal("10.00"), 3, BigDecimal.ZERO)
        );

        assertThat(service.calculateTotal(items))
            .isEqualByComparingTo("30.00");
    }

    @Test
    void shouldApplyDiscountPerItem() {
        var items = List.of(
            new Item("Book", new BigDecimal("10.00"), 2, new BigDecimal("0.10"))
        );

        assertThat(service.calculateTotal(items))
            .isEqualByComparingTo("18.00");
    }
}
