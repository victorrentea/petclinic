package victor.training.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.TimeSlot;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TimeSlotRepository extends Repository<TimeSlot, Integer> {

    Optional<TimeSlot> findById(int id);

    TimeSlot save(TimeSlot timeSlot);

    List<TimeSlot> saveAll(Iterable<TimeSlot> timeSlots);

    List<TimeSlot> findByVetIdAndDate(int vetId, LocalDate date);

    @Query("""
            SELECT s FROM TimeSlot s
            WHERE s.vet.id = :vetId AND s.date = :date
              AND NOT EXISTS (SELECT 1 FROM Visit v WHERE v.timeSlot = s)
            ORDER BY s.startTime""")
    List<TimeSlot> findFreeSlots(int vetId, LocalDate date);
}
