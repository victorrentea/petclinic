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

    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);

    // Never paged: a LIMIT over collection fetch joins would cut pets, or page in memory
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
