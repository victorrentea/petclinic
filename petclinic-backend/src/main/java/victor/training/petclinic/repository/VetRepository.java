package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.lang.Nullable;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Vet;

import java.util.List;
import java.util.Optional;

public interface VetRepository extends Repository<Vet, Integer> {
    @Query("SELECT DISTINCT v FROM Vet v LEFT JOIN FETCH v.specialties")
    List<Vet> findAll();

    @Query("SELECT v FROM Vet v LEFT JOIN FETCH v.specialties WHERE v.id = :id")
    Optional<Vet> findById(int id);

    /**
     * The attending-vet rule, in one place: a null vetId means "no vet attended (yet)",
     * an unknown one is rejected. Both write paths that accept a vetId from a DTO
     * (VisitRestController, OwnerRestController) need it, so it lives here rather than
     * as a private copy in each controller.
     */
    @Nullable
    default Vet getByIdOrNull(@Nullable Integer vetId) {
        if (vetId == null) {
            return null;
        }
        return findById(vetId).orElseThrow();
    }

    void save(Vet vet);

    void delete(Vet vet);

}
