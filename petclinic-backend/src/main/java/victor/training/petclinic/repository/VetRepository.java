package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Vet;

import java.util.List;
import java.util.Optional;

public interface VetRepository extends Repository<Vet, Integer> {
    @Query("SELECT DISTINCT v FROM Vet v LEFT JOIN FETCH v.specialties")
    List<Vet> findAll();

    @Query("SELECT v FROM Vet v LEFT JOIN FETCH v.specialties WHERE v.id = :id")
    Optional<Vet> findById(int id);

    /** For callers that only need the vet as a reference — booking a visit reads no specialty. */
    @Query("SELECT v FROM Vet v WHERE v.id = :id")
    Optional<Vet> findByIdWithoutSpecialties(int id);

    void save(Vet vet);

    void delete(Vet vet);

}
