package org.springframework.samples.petclinic.invoice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvoiceServiceTest {

    private final InvoiceService service = new InvoiceService();

    @Test
    void emptyList_returnsZeroWithScale2() {
        BigDecimal total = service.calculateTotal(List.of());

        assertThat(total).isEqualByComparingTo("0.00");
        assertThat(total.scale()).isEqualTo(2);
    }

    @Test
    void singleItem() {
        Item item = Item.builder()
            .name("Widget")
            .price(new BigDecimal("10"))
            .quantity(2)
            .discount(new BigDecimal("1"))
            .build();

        BigDecimal total = service.calculateTotal(List.of(item));

        assertThat(total).isEqualByComparingTo("19.00");
        assertThat(total.scale()).isEqualTo(2);
    }

    @Test
    void multipleItems_sum() {
        Item a = Item.builder()
            .name("A")
            .price(new BigDecimal("10"))
            .quantity(2)
            .discount(new BigDecimal("1"))
            .build();
        Item b = Item.builder()
            .name("B")
            .price(new BigDecimal("5.50"))
            .quantity(4)
            .discount(BigDecimal.ZERO)
            .build();

        BigDecimal total = service.calculateTotal(List.of(a, b));

        assertThat(total).isEqualByComparingTo("41.00");
        assertThat(total.scale()).isEqualTo(2);
    }

    @Test
    void rounding_halfUp() {
        Item item = Item.builder()
            .name("X")
            .price(new BigDecimal("0.005"))
            .quantity(1)
            .discount(BigDecimal.ZERO)
            .build();

        BigDecimal total = service.calculateTotal(List.of(item));

        assertThat(total).isEqualByComparingTo("0.01");
    }

    @Test
    void nullList_throws() {
        assertThatThrownBy(() -> service.calculateTotal(null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
