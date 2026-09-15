package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PetRepository extends Repository<Pet, Integer> {

    @Query("SELECT ptype FROM PetType ptype ORDER BY ptype.name")
    List<PetType> findPetTypes();

    /**
     * A projection, not {@code List<Pet>}: {@code Pet.owner}/{@code Pet.type} are eager
     * {@code @ManyToOne}, so materializing full {@code Pet} entities here would trigger one
     * extra select per distinct owner/type id behind the caller's back — exactly the N+1
     * this query exists to avoid (see design D5).
     */
    @Query("SELECT p.owner.id AS ownerId, p.name AS name FROM Pet p WHERE p.owner.id IN :ownerIds")
    List<OwnerPetName> findOwnerIdAndNameByOwnerIdIn(@Param("ownerIds") Collection<Integer> ownerIds);

    interface OwnerPetName {
        Integer getOwnerId();

        String getName();
    }

    Optional<Pet> findById(int id);

    Pet save(Pet pet);

    List<Pet> findAll();

    void delete(Pet pet);

    void flush();
}
