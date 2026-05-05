package org.springframework.samples.petclinic.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;

public interface OwnerRepository extends Repository<Owner, Integer> {
    @Query(value = """
        SELECT new org.springframework.samples.petclinic.rest.dto.OwnerDto(
            o.id, o.firstName, o.lastName, o.address, o.city, o.telephone)
        FROM Owner o
        WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.city)      LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.address)   LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :q, '%'))
        """,
        countQuery = """
        SELECT COUNT(o) FROM Owner o
        WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.city)      LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.address)   LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :q, '%'))
        """)
    Page<OwnerDto> search(@Param("q") String q, Pageable pageable);

    Optional<Owner> findById(int id);

//    Optional<OwnerDto> findByFirstName(String firstName);

    Owner save(Owner owner);

    @Query(value = """
        SELECT new org.springframework.samples.petclinic.rest.dto.OwnerDto(
            o.id, o.firstName, o.lastName, o.address, o.city, o.telephone)
        FROM Owner o
        """,
        countQuery = "SELECT COUNT(o) FROM Owner o")
    Page<OwnerDto> findAll(Pageable pageable);

    void delete(Owner owner);

}
