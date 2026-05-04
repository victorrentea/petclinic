package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {
    List<Owner> findByLastNameStartingWith(String lastName);

    @Query("""
        SELECT o FROM Owner o
        WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.city)      LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.address)   LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :q, '%'))
        """)
    List<Owner> search(@Param("q") String q);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
