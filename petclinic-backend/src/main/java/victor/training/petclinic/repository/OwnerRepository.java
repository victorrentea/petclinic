package victor.training.petclinic.repository;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);

    // No Pageable here: LIMIT over a JOIN FETCH-ed collection would make Hibernate page in memory
    @Query("""
            SELECT o FROM Owner o
            LEFT JOIN FETCH o.pets p LEFT JOIN FETCH p.type LEFT JOIN FETCH p.visits
            WHERE o.id IN :ids""")
    List<Owner> findByIdInFetchingPetsAndVisits(Collection<Integer> ids);

    /**
     * The database cuts the page of owners, then one more query loads the pets, types and visits
     * of just those owners — never of every match.
     */
    default Page<Owner> findPageFetchingPetsAndVisits(String lastNamePrefix, Pageable pageable) {
        Page<Owner> page = findByLastNameStartingWith(lastNamePrefix, pageable);
        if (page.isEmpty()) {
            return page;
        }
        Map<Integer, Owner> fetchedById = findByIdInFetchingPetsAndVisits(page.map(Owner::getId).getContent())
                .stream().collect(toMap(Owner::getId, identity()));
        return page.map(owner -> Optional.ofNullable(fetchedById.get(owner.getId())).orElseThrow(
                () -> new IllegalStateException("Owner " + owner.getId() + " vanished before its pets loaded")));
    }

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
