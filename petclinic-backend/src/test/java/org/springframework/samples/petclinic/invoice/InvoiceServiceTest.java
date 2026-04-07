package org.springframework.samples.petclinic.invoice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceServiceTest {

    private final InvoiceService service = new InvoiceService();

    @Test
    void shouldReturnZeroForEmptyList() {
        var total = service.calculateTotal(List.of());
        assertThat(total).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void shouldMultiplyPriceByQuantityWhenNoDiscount() {
        var items = List.of(Item.builder()
            .name("x")
            .price(new BigDecimal("10.00"))
            .quantity(2)
            .discount(BigDecimal.ZERO)
            .build());
        var total = service.calculateTotal(items);
        assertThat(total).isEqualByComparingTo("20.00");
    }

    @Test
    void shouldSubtractDiscountBeforeMultiplyingByQuantity() {
        var items = List.of(Item.builder()
            .name("x")
            .price(new BigDecimal("10.00"))
            .quantity(3)
            .discount(new BigDecimal("2.00"))
            .build());
        var total = service.calculateTotal(items);
        assertThat(total).isEqualByComparingTo("24.00");
    }

    @Test
    void shouldSumTotalsAcrossAllItems() {
        var items = List.of(
            Item.builder()
                .name("a")
                .price(new BigDecimal("5.00"))
                .quantity(2)
                .discount(BigDecimal.ZERO)
                .build(),
            Item.builder()
                .name("b")
                .price(new BigDecimal("8.00"))
                .quantity(1)
                .discount(new BigDecimal("1.00"))
                .build()
        );
        var total = service.calculateTotal(items);
        assertThat(total).isEqualByComparingTo("17.00");
    }
}
