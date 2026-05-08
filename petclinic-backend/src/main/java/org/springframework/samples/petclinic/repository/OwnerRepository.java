package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

    @Query("""
        SELECT owner FROM Owner owner
        WHERE :q IS NULL OR :q = ''
            OR UPPER(owner.firstName) LIKE UPPER(CONCAT('%', :q, '%'))
            OR UPPER(owner.lastName)  LIKE UPPER(CONCAT('%', :q, '%'))
            OR UPPER(owner.address)   LIKE UPPER(CONCAT('%', :q, '%'))
            OR UPPER(owner.city)      LIKE UPPER(CONCAT('%', :q, '%'))
            OR UPPER(owner.telephone) LIKE UPPER(CONCAT('%', :q, '%'))
            OR EXISTS (
                SELECT 1 FROM Pet pet
                WHERE pet.owner = owner
                  AND UPPER(pet.name) LIKE UPPER(CONCAT('%', :q, '%'))
            )
        """)
    Page<Owner> findBySearch(@Param("q") @org.springframework.lang.Nullable String q, Pageable pageable);

}
