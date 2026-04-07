package org.springframework.samples.petclinic.invoice.cucumber;

import io.cucumber.java.ParameterType;
import io.cucumber.java.es.Cuando;
import io.cucumber.java.es.Dado;
import io.cucumber.java.es.Entonces;
import io.cucumber.datatable.DataTable;
import org.springframework.samples.petclinic.invoice.InvoiceService;
import org.springframework.samples.petclinic.invoice.Item;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class InvoiceSteps {

    private final InvoiceService service = new InvoiceService();
    private List<Item> items = new ArrayList<>();
    private BigDecimal total;

    @ParameterType("[0-9]+\\.[0-9]+")
    public BigDecimal importe(String value) {
        return new BigDecimal(value);
    }

    @Dado("una factura sin artículos")
    public void unaFacturaSinArticulos() {
        items = List.of();
    }

    @Dado("una factura con los siguientes artículos")
    public void unaFacturaConLosSiguientesArticulos(DataTable table) {
        items = table.asMaps().stream()
            .map(this::toItem)
            .toList();
    }

    @Cuando("se calcula el total")
    public void seCalculaElTotal() {
        total = service.calculateTotal(items);
    }

    @Entonces("el total es {importe}")
    public void elTotalEs(BigDecimal expected) {
        assertThat(total).isEqualByComparingTo(expected);
    }

    private Item toItem(Map<String, String> row) {
        return Item.builder()
            .name(row.get("nombre"))
            .price(new BigDecimal(row.get("precio")))
            .quantity(Integer.parseInt(row.get("cantidad")))
            .discount(new BigDecimal(row.get("descuento")))
            .build();
    }
}
