package org.springframework.samples.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;

import java.util.List;
import java.util.Optional;

public interface PetRepository extends Repository<Pet, Integer> {

    @Query("SELECT ptype FROM PetType ptype ORDER BY ptype.name")
    List<PetType> findPetTypes();

    Optional<Pet> findById(int id);

    Pet save(Pet pet);

    List<Pet> findAll();

    void delete(Pet pet);

    void flush();
}
