package victor.training.petclinic.rest;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;

public class TestData {
    public static Owner anOwner() {
        return new Owner()
            .setCity("London")
            .setAddress("Baker St 221B")
            .setFirstName("Sherlock")
            .setLastName("Holmes")
            .setTelephone("1234567890");
    }

    public static Pet aPet() {
        return new Pet()
//            .setId(1)
            .setName("Leo")
            .setBirthDate(PetTest.BIRTH_DATE);
    }
}
