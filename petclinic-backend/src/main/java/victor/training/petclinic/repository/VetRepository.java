package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.lang.Nullable;
import victor.training.petclinic.domain.Vet;

import java.util.List;
import java.util.Optional;

public interface VetRepository extends Repository<Vet, Integer> {
    @Query("SELECT DISTINCT v FROM Vet v LEFT JOIN FETCH v.specialties")
    List<Vet> findAll();

    @Query("SELECT v FROM Vet v LEFT JOIN FETCH v.specialties WHERE v.id = :id")
    Optional<Vet> findById(int id);

    /** For an optional vet reference: null when no id is given, NoSuchElementException for an unknown one. */
    default @Nullable Vet findByIdOrNull(@Nullable Integer id) {
        return id == null ? null : findById(id).orElseThrow();
    }

    void save(Vet vet);

    void delete(Vet vet);

}
