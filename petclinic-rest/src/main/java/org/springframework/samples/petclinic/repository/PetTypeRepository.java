package org.springframework.samples.petclinic.repository;

import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.PetType;

import java.util.List;
import java.util.Optional;

public interface PetTypeRepository extends Repository<PetType, Integer> {

    List<PetType> findAll();

    Optional<PetType> findById(int id);

    PetType save(PetType petType);

    void delete(PetType petType);

}
