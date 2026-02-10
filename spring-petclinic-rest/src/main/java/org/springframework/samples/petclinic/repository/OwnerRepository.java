package org.springframework.samples.petclinic.repository;

import org.springframework.data.domain.Limit;
import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.Owner;

import java.util.List;
import java.util.Optional;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameIgnoreCaseStartingWith(String lastName);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
