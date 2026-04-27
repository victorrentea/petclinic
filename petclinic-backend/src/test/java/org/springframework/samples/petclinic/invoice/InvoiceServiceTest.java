package org.springframework.samples.petclinic.invoice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvoiceServiceTest {

    private final InvoiceService service = new InvoiceService();

    @Test
    void calculateTotal_emptyList_returnsZero() {
        var items = List.<Item>of();
        var total = service.calculateTotal(items);
        assertThat(total).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void calculateTotal_singleItemNoDiscount_returnsPriceTimesQuantity() {
        var items = List.of(item("10.00", 2, "0.00"));
        assertThat(service.calculateTotal(items)).isEqualByComparingTo("20.00");
    }

    @Test
    void calculateTotal_discountSubtractedBeforeMultiplyingByQuantity() {
        var items = List.of(item("10.00", 3, "2.00")); // (10 - 2) * 3 = 24
        assertThat(service.calculateTotal(items)).isEqualByComparingTo("24.00");
    }

    @Test
    void calculateTotal_multipleItems_summed() {
        var items = List.of(
            item("5.00", 2, "0.00"),  // 10.00
            item("8.00", 1, "1.00")   //  7.00
        );
        assertThat(service.calculateTotal(items)).isEqualByComparingTo("17.00");
    }

    @Test
    void calculateTotal_negativeDiscount_actsAsSurcharge() {
        var items = List.of(item("10.00", 3, "-2.00")); // (10 - (-2)) * 3 = 36
        assertThat(service.calculateTotal(items)).isEqualByComparingTo("36.00");
    }

    @Test
    void calculateTotal_discountExceedsPrice_throws() {
        var items = List.of(item("5.00", 2, "10.00"));
        assertThatThrownBy(() -> service.calculateTotal(items))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void calculateTotal_fullDiscount_itemContributesZero() {
        var items = List.of(
            item("5.00", 3, "5.00"),  // (5 - 5) * 3 = 0
            item("10.00", 2, "0.00") // 20.00
        );
        assertThat(service.calculateTotal(items)).isEqualByComparingTo("20.00");
    }

    // --- helpers ---

    private Item item(String price, int quantity, String discount) {
        return Item.builder()
            .name("test")
            .price(new BigDecimal(price))
            .quantity(quantity)
            .discount(new BigDecimal(discount))
            .build();
    }

}
