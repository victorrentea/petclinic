package victor.training.petclinic.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Visit;

import java.util.List;
import java.util.Optional;

public interface VisitRepository extends Repository<Visit, Integer> {

    Optional<Visit> findById(int id);

    Visit save(Visit visit);

    List<Visit> findAll();

    @Query(value = "SELECT v FROM Visit v JOIN FETCH v.pet p JOIN FETCH p.owner",
            countQuery = "SELECT count(v) FROM Visit v JOIN v.pet p JOIN p.owner")
    Page<Visit> findAllWithPetAndOwner(Pageable pageable);

    void delete(Visit visit);

    List<Visit> findByPetId(int petId);
}
