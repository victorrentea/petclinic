package victor.training.petclinic.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import victor.training.petclinic.domain.Owner;

public interface OwnerRepository extends JpaRepository<Owner, Integer> {

    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

}
