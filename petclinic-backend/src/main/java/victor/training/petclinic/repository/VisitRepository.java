package victor.training.petclinic.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.rest.dto.VisitRowDto;

import java.util.List;
import java.util.Optional;

public interface VisitRepository extends Repository<Visit, Integer> {

    Optional<Visit> findById(int id);

    Visit save(Visit visit);

    List<Visit> findAll();

    @Query(value = """
            SELECT new victor.training.petclinic.rest.dto.VisitRowDto(
                v.id, v.date, v.description, p.name, o.id, o.firstName, o.lastName)
            FROM Visit v JOIN v.pet p JOIN p.owner o""",
            countQuery = "SELECT count(v) FROM Visit v")
    Page<VisitRowDto> findRows(Pageable pageable);

    void delete(Visit visit);

    List<Visit> findByPetId(int petId);
}
