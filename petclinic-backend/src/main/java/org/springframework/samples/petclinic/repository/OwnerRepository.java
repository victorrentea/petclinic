package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {


    @Query("SELECT o FROM Owner o WHERE " +
        "UPPER(o.lastName) LIKE UPPER(CONCAT('%', :query, '%')) OR " +
        "UPPER(o.firstName) LIKE UPPER(CONCAT('%', :query, '%')) OR " +
        "UPPER(o.city) LIKE UPPER(CONCAT('%', :query, '%')) OR " +
        "UPPER(o.address) LIKE UPPER(CONCAT('%', :query, '%')) OR " +
        "o.telephone LIKE CONCAT('%', :query, '%') OR " +
        "EXISTS (SELECT p FROM Pet p WHERE p.owner = o AND UPPER(p.name) LIKE UPPER(CONCAT('%', :query, '%')))")
    List<Owner> searchOwners(@Param("query") String query);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
