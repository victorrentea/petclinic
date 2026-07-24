package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameStartingWith(String lastName);

    /**
     * The paged owners grid. Both the prefix filter and the ordering run in the database — at the
     * planned 10,000 owners, loading the table to filter or sort it in Java is the production
     * incident this endpoint exists to avoid.
     * <p>
     * <b>Do not add a collection {@code JOIN FETCH} (e.g. {@code o.pets}) to this query.</b>
     * Hibernate cannot paginate a collection join in SQL, so it silently fetches every matching row
     * and applies {@code firstResult}/{@code maxResults} in memory, logging {@code HHH000104} — the
     * exact failure mode being avoided. Pets and visits are loaded by batch fetching instead
     * ({@code hibernate.default_batch_fetch_size}); {@code OwnerPageQueryCountTest} guards both.
     */
    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
