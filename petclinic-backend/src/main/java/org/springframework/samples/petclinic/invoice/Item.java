package org.springframework.samples.petclinic.invoice;

import java.math.BigDecimal;

import lombok.Builder;

@Builder
record Item(
    String name,
    BigDecimal price,
    int quantity,
    BigDecimal discount
) {}
