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

    @Query(value = """
        select distinct owner
        from Owner owner
        left join owner.pets pet
        where lower(owner.firstName) like lower(concat('%', :q, '%'))
            or lower(owner.lastName) like lower(concat('%', :q, '%'))
            or lower(owner.city) like lower(concat('%', :q, '%'))
            or lower(owner.address) like lower(concat('%', :q, '%'))
            or lower(owner.telephone) like lower(concat('%', :q, '%'))
            or lower(pet.name) like lower(concat('%', :q, '%'))
        """,
        countQuery = """
            select count(distinct owner.id)
            from Owner owner
            left join owner.pets pet
            where lower(owner.firstName) like lower(concat('%', :q, '%'))
                or lower(owner.lastName) like lower(concat('%', :q, '%'))
                or lower(owner.city) like lower(concat('%', :q, '%'))
                or lower(owner.address) like lower(concat('%', :q, '%'))
                or lower(owner.telephone) like lower(concat('%', :q, '%'))
                or lower(pet.name) like lower(concat('%', :q, '%'))
            """)
    Page<Owner> search(@Param("q") String q, Pageable pageable);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
