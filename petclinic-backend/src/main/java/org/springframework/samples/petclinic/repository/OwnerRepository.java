package org.springframework.samples.petclinic.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends JpaRepository<Owner, Integer> {

    @Query("""
        SELECT o FROM Owner o
        WHERE :q = ''
          OR LOWER(FUNCTION('unaccent', o.firstName)) LIKE LOWER(FUNCTION('unaccent', :q))
          OR LOWER(FUNCTION('unaccent', o.lastName))  LIKE LOWER(FUNCTION('unaccent', :q))
          OR LOWER(FUNCTION('unaccent', o.city))       LIKE LOWER(FUNCTION('unaccent', :q))
          OR LOWER(FUNCTION('unaccent', o.address))    LIKE LOWER(FUNCTION('unaccent', :q))
          OR o.telephone                               LIKE :q
          OR EXISTS (
               SELECT 1 FROM Pet p
               WHERE p.owner = o
               AND LOWER(FUNCTION('unaccent', p.name)) LIKE LOWER(FUNCTION('unaccent', :q))
             )
        """)
    Page<Owner> findByQuery(@Param("q") String q, Pageable pageable);
}
