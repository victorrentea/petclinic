package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;

public interface OwnerRepository extends Repository<Owner, Integer> {

    @Query("""
        SELECT new victor.training.petclinic.rest.dto.OwnerDto(
            o.id, o.firstName, o.lastName, o.address, o.city, o.telephone)
        FROM Owner o
        WHERE o.lastName LIKE CONCAT(?1, '%')
        """)
    List<OwnerDto> findDtosByLastNameStartingWith(String lastNamePrefix);

    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

    long count();

}
