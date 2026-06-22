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

    @Query("""
        SELECT o FROM Owner o
        WHERE lower(o.firstName) LIKE :pattern ESCAPE '\\'
           OR lower(o.lastName)  LIKE :pattern ESCAPE '\\'
           OR lower(o.address)   LIKE :pattern ESCAPE '\\'
           OR lower(o.city)      LIKE :pattern ESCAPE '\\'
           OR lower(o.telephone) LIKE :pattern ESCAPE '\\'
           OR EXISTS (SELECT p FROM Pet p WHERE p.owner = o
                      AND lower(p.name) LIKE :pattern ESCAPE '\\')
        """)
    Page<Owner> searchOwners(@Param("pattern") String pattern, Pageable pageable);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
