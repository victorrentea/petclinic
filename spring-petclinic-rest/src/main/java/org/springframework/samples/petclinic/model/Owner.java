package org.springframework.samples.petclinic.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.support.MutableSortDefinition;
import org.springframework.beans.support.PropertyComparator;
import org.springframework.core.style.ToStringCreator;

import java.util.*;

@Entity
@Table(name = "owners")
@Getter
@Setter
public class Owner {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    @NotEmpty
    protected String firstName;

    @NotEmpty
    protected String lastName;

    @NotEmpty
    private String address;

    @NotEmpty
    private String city;

    @NotEmpty
    @Digits(fraction = 0, integer = 10)
    @Pattern(regexp = "^[0-9]{10}$", message = "Phone number must be exactly 10 digits")
    private String telephone;

    @OneToMany(cascade = CascadeType.ALL, mappedBy = "owner", fetch = FetchType.EAGER)
    private Set<Pet> pets = new HashSet<>();

    public List<Pet> getPets() {
        List<Pet> sortedPets = new ArrayList<>(pets);
        PropertyComparator.sort(sortedPets, new MutableSortDefinition("name", true, true));
        return Collections.unmodifiableList(sortedPets);
    }

    public void setPets(List<Pet> pets) {
        this.pets = new HashSet<>(pets);
    }

    public void addPet(Pet pet) {
        pets.add(pet);
        pet.setOwner(this);
    }

    public Optional<Pet> getPetById(int petId) {
        return pets.stream()
            .filter(p -> p.getId().equals(petId))
            .findFirst();
    }

    @Override
    public String toString() {
        return new ToStringCreator(this)

            .append("id", id)
            .append("lastName", lastName)
            .append("firstName", firstName)
            .append("address", address)
            .append("city", city)
            .append("telephone", telephone)
            .toString();
    }
}
