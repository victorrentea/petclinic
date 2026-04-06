package org.springframework.samples.petclinic.invoice;

import static org.assertj.core.api.Assertions.assertThat;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.ArrayList;
import java.math.BigDecimal;
import java.util.List;

public class InvoiceServiceStepDefinitions {

    private final InvoiceService service = new InvoiceService();
    private List<Item> items = new ArrayList<>();
    private BigDecimal total;

    @Given("ca factura are articolul {string} cu pretul {string}, cantitatea {int} si discountul {string}")
    public void facturaAreArticolulCuPretCantitateSiDiscount(String name, String price, int quantity, String discount) {
        items = new ArrayList<>();
        items.add(new Item(name, new BigDecimal(price), quantity, new BigDecimal(discount)));
    }

    @Given("factura mai are articolul {string} cu pretul {string}, cantitatea {int} si discountul {string}")
    public void facturaMaiAreArticolulCuPretCantitateSiDiscount(String name, String price, int quantity,
            String discount) {
        items.add(new Item(name, new BigDecimal(price), quantity, new BigDecimal(discount)));
    }

    @When("calculez totalul")
    public void calculezTotalul() {
        total = service.calculateTotal(items);
    }

    @Then("totalul ar trebui sa fie {string}")
    public void totalulArTrebuieSaFie(String expectedTotal) {
        assertThat(total).isEqualByComparingTo(expectedTotal);
    }
}

