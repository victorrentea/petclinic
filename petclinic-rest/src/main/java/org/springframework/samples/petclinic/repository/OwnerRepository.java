package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(String firstName, String lastName);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
