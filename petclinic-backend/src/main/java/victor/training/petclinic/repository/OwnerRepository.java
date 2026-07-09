package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import victor.training.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameStartingWith(String lastName);

    /**
     * One page of owners whose last name starts with {@code lastName}, case-insensitively.
     * Explicit {@code lower(...)} (not a derived {@code ...IgnoreCase} finder, which renders
     * {@code upper()}) so the filter uses the {@code owners_lower_last_first_idx} functional index —
     * the same index a {@code Sort} built with {@code ignoreCase()} (rendered as {@code lower()}) uses.
     * The {@link Pageable}'s sort must always end with {@code id} for deterministic paging.
     */
    @Query("SELECT o FROM Owner o WHERE lower(o.lastName) LIKE lower(concat(:lastName, '%'))")
    Page<Owner> findPageByLastNamePrefix(@Param("lastName") String lastName, Pageable pageable);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
