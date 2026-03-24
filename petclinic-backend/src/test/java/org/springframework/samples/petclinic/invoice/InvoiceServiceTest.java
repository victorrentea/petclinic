package org.springframework.samples.petclinic.invoice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.assertThatThrownBy;

class InvoiceServiceTest {

    private final InvoiceService service = new InvoiceService();
    private static final BigDecimal ZERO_DISCOUNT = new BigDecimal("0.00");

    @Test
    void returns0_forEmptyCart() {
        List<Item> items = List.of();
        BigDecimal total = service.total(items);
        assertThat(total).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void returnsPriceOfSingleItem() {
        List<Item> items = List.of(
            new Item("item1", new BigDecimal("10.00"), 1, ZERO_DISCOUNT)
        );
        BigDecimal total = service.total(items);
        assertThat(total).isEqualByComparingTo(new BigDecimal("10.00"));
    }

    @Test
    void returnsPriceOfMultipleItems() {
        List<Item> items = List.of(
            new Item("item1", new BigDecimal("10.00"), 2,ZERO_DISCOUNT),
            new Item("item2", new BigDecimal("5.00"), 1, ZERO_DISCOUNT)
        );
        BigDecimal total = service.total(items);
        assertThat(total).isEqualByComparingTo(new BigDecimal("25.00"));
    }

    @Test
    void appliesDiscountToItem() {
        List<Item> items = List.of(
            new Item("item1", new BigDecimal("10.00"), 1, new BigDecimal("0.10"))
        );
        BigDecimal total = service.total(items);
        assertThat(total).isEqualByComparingTo(new BigDecimal("9.00"));
    }

    // ❌ discount > 100% ⇒ throw
    @Test
    void rejectsDiscountGreaterThan100Percent() {
        List<Item> items = List.of(
            new Item("item1", new BigDecimal("10.00"), 1, new BigDecimal("1.50"))
        );
        service.total(items);
        assertThatThrownBy(() -> service.total(items))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Discount cannot be greater than 100%");
    }

    // ❌ quantity < 0 => throw
    @Test
    void rejectsNegativeQuantity() {
        List<Item> items = List.of(
            new Item("item1", new BigDecimal("10.00"), -1, ZERO_DISCOUNT)
        );
        service.total(items);
        assertThatThrownBy(() -> service.total(items))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Quantity cannot be negative");
    }
    // ❌ price < 0
    @Test
    void rejectsNegativePrice() {
        List<Item> items = List.of(
            new Item("item1", new BigDecimal("-10.00"), 1, ZERO_DISCOUNT)
        );
        service.total(items);
        assertThatThrownBy(() -> service.total(items))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Price cannot be negative");
    }
    // ❌ nulls

}
