package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.model.Visit;

import java.util.List;
import java.util.Optional;

public interface VisitRepository extends Repository<Visit, Integer> {

    Optional<Visit> findById(int id);

    Visit save(Visit visit);

    List<Visit> findAll();

    @Query("SELECT v FROM Visit v JOIN FETCH v.pet p JOIN FETCH p.owner")
    List<Visit> findAllWithPetAndOwner();

    void delete(Visit visit);

    List<Visit> findByPetId(int petId);
}
