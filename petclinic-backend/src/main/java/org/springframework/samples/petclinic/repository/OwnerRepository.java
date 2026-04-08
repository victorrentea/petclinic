package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameStartingWith(String lastName);

    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    Page<Owner> findAll(Pageable pageable);

    void delete(Owner owner);

}
