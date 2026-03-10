package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    @Query("""
        SELECT owner FROM Owner owner
        WHERE :search IS NULL OR :search = ''
            OR UPPER(owner.firstName) LIKE UPPER(CONCAT('%', :search, '%'))
            OR UPPER(owner.lastName) LIKE UPPER(CONCAT('%', :search, '%'))
            OR UPPER(owner.address) LIKE UPPER(CONCAT('%', :search, '%'))
            OR UPPER(owner.city) LIKE UPPER(CONCAT('%', :search, '%'))
        """)
    Page<Owner> findBySearch(String search, Pageable pageable);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
