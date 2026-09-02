package victor.training.petclinic.rest;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;

public class TestData {
    public static Owner anOwner() {
        Owner owner = new Owner();
        owner.setCity("London");
        owner.setAddress("Baker St 221B");
        owner.setFirstName("Sherlock");
        owner.setLastName("Holmes");
        owner.setTelephone("1234567890");
        return owner;
    }

    public static Pet aPet() {
        Pet pet = new Pet();
        pet.setName("Leo");
        pet.setBirthDate(PetTest.BIRTH_DATE);
        return pet;
    }

    public static PetType aPetType(String name) {
        PetType petType = new PetType();
        petType.setName(name);
        return petType;
    }
}
