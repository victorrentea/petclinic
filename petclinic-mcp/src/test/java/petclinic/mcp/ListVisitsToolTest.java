package petclinic.mcp;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ListVisitsToolTest {

    @Autowired VisitMcpTools visitTools;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired VisitRepository visitRepository;

    @Test
    void lists_visits_of_a_given_owner() {
        Owner owner = new Owner();
        owner.setFirstName("Tdd");
        owner.setLastName("Tester");
        owner.setAddress("1 Test Way");
        owner.setCity("Testville");
        owner.setTelephone("0000000000");
        PetType firstType = petRepository.findPetTypes().get(0);
        Pet pet = new Pet();
        pet.setName("Rex");
        pet.setBirthDate(LocalDate.of(2020, 1, 1));
        pet.setType(firstType);
        owner.addPet(pet);
        ownerRepository.save(owner);

        Visit visit = new Visit();
        visit.setPet(pet);
        visit.setDate(LocalDate.of(2026, 5, 24));
        visit.setDescription("Annual checkup");
        visitRepository.save(visit);

        List<VisitMcpTools.VisitView> visits = visitTools.listVisitsFor(owner.getId());

        assertThat(visits)
            .extracting(VisitMcpTools.VisitView::description)
            .contains("Annual checkup");
    }
}
