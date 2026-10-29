package victor.training.petclinic.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameStartingWith(String lastName);

    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);

    // Unpaged on purpose: LIMIT over a collection fetch would page in memory, after loading every row.
    @Query("""
            SELECT o FROM Owner o
            LEFT JOIN FETCH o.pets p
            LEFT JOIN FETCH p.type
            LEFT JOIN FETCH p.visits
            WHERE o.id IN :ids""")
    List<Owner> findAllByIdFetchingPetsAndVisits(Collection<Integer> ids);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
