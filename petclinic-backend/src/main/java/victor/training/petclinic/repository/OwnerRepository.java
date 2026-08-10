package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameStartingWith(String lastName);

    @Query("""
            SELECT DISTINCT o
            FROM Owner o
            LEFT JOIN o.pets p
            WHERE LOWER(CONCAT(o.firstName, ' ', o.lastName)) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(o.address) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(o.city) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%'))
            """)
    List<Owner> searchByQuery(String query);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
