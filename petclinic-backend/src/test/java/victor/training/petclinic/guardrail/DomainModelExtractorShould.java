package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static victor.training.petclinic.guardrail.DomainModelExtractor.MANY;

class DomainModelExtractorShould {

    private final DomainModelExtractor model = new DomainModelExtractor();

    @Test
    void readAUnidirectionalManyToManyAsManyAtBothEnds() {
        DomainModelExtractor.Association vetSpecialty = model.associations(model.domainClasses()).stream()
                .filter(a -> a.key().equals("Specialty-Vet"))
                .findFirst().orElseThrow();

        assertThat(vetSpecialty.cardinalityAt("Specialty")).isEqualTo(MANY);
        assertThat(vetSpecialty.cardinalityAt("Vet")).isEqualTo(MANY);
    }
}
