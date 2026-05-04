package org.springframework.samples.petclinic.invoice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ItemTest {

    @Test
    void lineTotal_happyPath() {
        Item item = Item.builder()
            .name("Widget")
            .price(new BigDecimal("10"))
            .quantity(3)
            .discount(new BigDecimal("5"))
            .build();

        assertThat(item.lineTotal()).isEqualByComparingTo("25");
    }

    @Test
    void lineTotal_zeroQuantity() {
        Item item = Item.builder()
            .name("Widget")
            .price(new BigDecimal("10"))
            .quantity(0)
            .discount(BigDecimal.ZERO)
            .build();

        assertThat(item.lineTotal()).isEqualByComparingTo("0");
    }

    @Test
    void lineTotal_discountExceedsLine_throws() {
        Item item = Item.builder()
            .name("Widget")
            .price(new BigDecimal("10"))
            .quantity(1)
            .discount(new BigDecimal("15"))
            .build();

        assertThatThrownBy(item::lineTotal).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructor_nullName_throws() {
        assertThatThrownBy(() -> Item.builder()
            .name(null)
            .price(BigDecimal.ONE)
            .quantity(1)
            .discount(BigDecimal.ZERO)
            .build()
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructor_nullPrice_throws() {
        assertThatThrownBy(() -> Item.builder()
            .name("X")
            .price(null)
            .quantity(1)
            .discount(BigDecimal.ZERO)
            .build()
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructor_negativePrice_throws() {
        assertThatThrownBy(() -> Item.builder()
            .name("X")
            .price(new BigDecimal("-1"))
            .quantity(1)
            .discount(BigDecimal.ZERO)
            .build()
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructor_nullDiscount_throws() {
        assertThatThrownBy(() -> Item.builder()
            .name("X")
            .price(BigDecimal.ONE)
            .quantity(1)
            .discount(null)
            .build()
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructor_negativeDiscount_throws() {
        assertThatThrownBy(() -> Item.builder()
            .name("X")
            .price(BigDecimal.ONE)
            .quantity(1)
            .discount(new BigDecimal("-0.01"))
            .build()
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructor_negativeQuantity_throws() {
        assertThatThrownBy(() -> Item.builder()
            .name("X")
            .price(BigDecimal.ONE)
            .quantity(-1)
            .discount(BigDecimal.ZERO)
            .build()
        ).isInstanceOf(IllegalArgumentException.class);
    }
}
