package org.springframework.samples.petclinic.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vets")
@Getter
@Setter
public class Vet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    @NotEmpty
    protected String firstName;

    @NotEmpty
    protected String lastName;

    @ManyToMany
    @JoinTable(name = "vet_specialties",
        joinColumns = @JoinColumn(name = "vet_id"),
        inverseJoinColumns = @JoinColumn(name = "specialty_id"),
        uniqueConstraints = @UniqueConstraint(columnNames = {"specialty_id", "vet_id"}))
    private List<Specialty> specialties = new ArrayList<>();


    public void clearSpecialties() {
        this.specialties.clear();
    }

    public int getNrOfSpecialties() {
        return specialties.size();
    }

    public void addSpecialty(Specialty specialty) {
        specialties.add(specialty);
    }

}
