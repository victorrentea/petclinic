package org.springframework.samples.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends PagingAndSortingRepository<Owner, Integer> {

    @Query("""
        select distinct o
        from Owner o
          where lower(o.firstName) like concat('%', lower(:searchText), '%')
              or lower(o.lastName) like concat('%', lower(:searchText), '%')
              or lower(o.address) like concat('%', lower(:searchText), '%')
              or lower(o.city) like concat('%', lower(:searchText), '%')
              or lower(o.telephone) like concat('%', lower(:searchText), '%')
        """)
    Page<Owner> searchByText(@Param("searchText") String searchText, Pageable pageable);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
