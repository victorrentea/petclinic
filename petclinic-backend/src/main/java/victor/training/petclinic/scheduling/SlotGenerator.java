package victor.training.petclinic.scheduling;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.TimeSlot;
import victor.training.petclinic.domain.VetSchedule;
import victor.training.petclinic.repository.TimeSlotRepository;
import victor.training.petclinic.repository.VetScheduleRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Keeps a rolling horizon of bookable slots ahead of today, expanded from the vets' weekly schedules. */
@Component
public class SlotGenerator {
    private static final Logger log = LoggerFactory.getLogger(SlotGenerator.class);

    /** How far ahead an owner can book. */
    public static final int HORIZON_DAYS = 14;

    private final VetScheduleRepository vetScheduleRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final Clock clock;

    public SlotGenerator(VetScheduleRepository vetScheduleRepository, TimeSlotRepository timeSlotRepository,
            Clock clock) {
        this.vetScheduleRepository = vetScheduleRepository;
        this.timeSlotRepository = timeSlotRepository;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "PT5S", fixedDelayString = "P1D")
    public void generateSlotsForHorizon() {
        LocalDate today = LocalDate.now(clock);
        List<VetSchedule> schedules = vetScheduleRepository.findAllWithVet();
        int created = 0;
        for (int dayOffset = 0; dayOffset < HORIZON_DAYS; dayOffset++) {
            LocalDate date = today.plusDays(dayOffset);
            for (VetSchedule schedule : schedules) {
                if (schedule.getDayOfWeek() == date.getDayOfWeek()) {
                    created += generateMissingSlots(schedule, date);
                }
            }
        }
        log.info("Generated {} time slots over the next {} days", created, HORIZON_DAYS);
    }

    private int generateMissingSlots(VetSchedule schedule, LocalDate date) {
        Set<LocalTime> alreadyGenerated = new HashSet<>();
        for (TimeSlot slot : timeSlotRepository.findByVetIdAndDate(schedule.getVet().getId(), date)) {
            alreadyGenerated.add(slot.getStartTime());
        }
        List<TimeSlot> missing = new ArrayList<>();
        for (LocalTime start : SlotPlan.startTimes(schedule.getStartTime(), schedule.getEndTime(),
                schedule.getSlotMinutes())) {
            if (!alreadyGenerated.contains(start)) {
                missing.add(new TimeSlot(schedule.getVet(), date, start, start.plusMinutes(schedule.getSlotMinutes())));
            }
        }
        timeSlotRepository.saveAll(missing);
        return missing.size();
    }
}
