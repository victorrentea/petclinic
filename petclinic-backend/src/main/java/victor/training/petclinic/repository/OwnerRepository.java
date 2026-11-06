package victor.training.petclinic.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    Page<Owner> findAll(Pageable pageable);

    /** {@code escapedPrefix} has its LIKE wildcards backslash-escaped. Served by owners_by_search_key. */
    @Query("""
            SELECT o FROM Owner o
            WHERE function('search_key' as String, o.lastName)
                LIKE concat(function('search_key' as String, :escapedPrefix), '%') ESCAPE '\\'
            """)
    Page<Owner> searchByLastName(String escapedPrefix, Pageable pageable);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
