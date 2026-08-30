package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.VetSchedule;

import java.util.List;

public interface VetScheduleRepository extends Repository<VetSchedule, Integer> {

    @Query("SELECT s FROM VetSchedule s JOIN FETCH s.vet")
    List<VetSchedule> findAllWithVet();

    VetSchedule save(VetSchedule vetSchedule);
}
