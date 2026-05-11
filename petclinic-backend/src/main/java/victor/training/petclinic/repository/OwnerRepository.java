package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.repository.Repository;
import victor.training.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    List<Owner> findByLastNameStartingWith(String lastName);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

}
