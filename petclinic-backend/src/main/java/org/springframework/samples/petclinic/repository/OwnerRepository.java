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

    List<Owner> findByLastNameStartingWith(String lastName);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

    @Query("""
        SELECT DISTINCT o FROM Owner o LEFT JOIN o.pets p
        WHERE :term = ''
           OR LOWER(FUNCTION('REPLACE', FUNCTION('REPLACE', o.firstName, '\u0218', 'S'), '\u00e9', 'e')) LIKE %:term%
           OR LOWER(FUNCTION('REPLACE', FUNCTION('REPLACE', o.lastName,  '\u0219', 's'), '\u0218', 'S')) LIKE %:term%
           OR LOWER(o.address)    LIKE %:term%
           OR LOWER(FUNCTION('REPLACE', FUNCTION('REPLACE', o.city, '\u0219', 's'), '\u021b', 't')) LIKE %:term%
           OR o.telephone         LIKE %:term%
           OR LOWER(p.name)       LIKE %:term%
        ORDER BY CONCAT(o.firstName, ' ', o.lastName) ASC
        """)
    Page<Owner> findPagedOwners(@Param("term") String term, Pageable pageable);

}
