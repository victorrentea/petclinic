package org.springframework.samples.petclinic.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

public interface OwnerRepository extends JpaRepository<Owner, Integer> {

    List<Owner> findByFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(String firstName, String lastName);

    Page<Owner> findByFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(String firstName,
                                                                                  String lastName,
                                                                                  Pageable pageable);

    List<Owner> findByAddressContainingIgnoreCaseOrCityContainingIgnoreCase(String address, String city);

    Page<Owner> findByAddressContainingIgnoreCaseOrCityContainingIgnoreCase(String address,
                                                                            String city,
                                                                            Pageable pageable);

    @Query("""
        select o
        from Owner o
        where (upper(o.firstName) like upper(concat('%', :name, '%'))
            or upper(o.lastName) like upper(concat('%', :name, '%')))
            and (upper(o.address) like upper(concat('%', :address, '%'))
            or upper(o.city) like upper(concat('%', :address, '%')))
        """)
    List<Owner> findByNameAndAddressContainingIgnoreCase(@Param("name") String name,
                                                        @Param("address") String address);

    @Query("""
        select o
        from Owner o
        where (upper(o.firstName) like upper(concat('%', :name, '%'))
            or upper(o.lastName) like upper(concat('%', :name, '%')))
            and (upper(o.address) like upper(concat('%', :address, '%'))
            or upper(o.city) like upper(concat('%', :address, '%')))
        """)
    Page<Owner> findByNameAndAddressContainingIgnoreCase(@Param("name") String name,
                                                        @Param("address") String address,
                                                        Pageable pageable);
}
