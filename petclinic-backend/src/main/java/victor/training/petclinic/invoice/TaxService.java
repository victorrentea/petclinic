package victor.training.petclinic.invoice;

import java.math.BigDecimal;
import java.math.RoundingMode;

class TaxService {

    BigDecimal applyVat(BigDecimal value) {
        return value
            .multiply(new BigDecimal("1.19"))
            .setScale(2, RoundingMode.HALF_UP);
    }
}
