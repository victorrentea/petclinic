package victor.training.petclinic.scheduling;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import victor.training.petclinic.domain.TimeSlot;
import victor.training.petclinic.domain.Vet;
import victor.training.petclinic.domain.VetSchedule;
import victor.training.petclinic.repository.TimeSlotRepository;
import victor.training.petclinic.repository.VetScheduleRepository;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SlotGeneratorTest {

    /** A Monday, so the horizon covers exactly two of each weekday. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 7);

    private final VetScheduleRepository vetScheduleRepository = mock(VetScheduleRepository.class);
    private final TimeSlotRepository timeSlotRepository = mock(TimeSlotRepository.class);
    private final List<TimeSlot> saved = new ArrayList<>();
    private SlotGenerator slotGenerator;

    @BeforeEach
    void before() {
        Clock clock = Clock.fixed(MONDAY.atStartOfDay(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());
        slotGenerator = new SlotGenerator(vetScheduleRepository, timeSlotRepository, clock);
        when(timeSlotRepository.findByVetIdAndDate(anyInt(), any())).thenReturn(List.of());
        when(timeSlotRepository.saveAll(any())).thenAnswer(invocation -> {
            List<TimeSlot> batch = new ArrayList<>();
            invocation.<Iterable<TimeSlot>>getArgument(0).forEach(batch::add);
            saved.addAll(batch);
            return batch;
        });
    }

    @Test
    void expandsAWeeklyScheduleOnEveryMatchingDayOfTheHorizon() {
        when(vetScheduleRepository.findAllWithVet()).thenReturn(List.of(aSchedule(DayOfWeek.MONDAY)));

        slotGenerator.generateSlotsForHorizon();

        // 09:00–11:00 in 30' slots = 4 per day, on the two Mondays inside a 14-day horizon
        assertThat(saved).hasSize(8);
        assertThat(saved).extracting(TimeSlot::getDate).containsOnly(MONDAY, MONDAY.plusDays(7));
        assertThat(saved).extracting(TimeSlot::getStartTime)
                .contains(LocalTime.of(9, 0), LocalTime.of(9, 30), LocalTime.of(10, 0), LocalTime.of(10, 30));
    }

    @Test
    void leavesAlreadyGeneratedSlotsAlone() {
        when(vetScheduleRepository.findAllWithVet()).thenReturn(List.of(aSchedule(DayOfWeek.MONDAY)));
        TimeSlot existing = new TimeSlot(aVet(), MONDAY, LocalTime.of(9, 0), LocalTime.of(9, 30));
        when(timeSlotRepository.findByVetIdAndDate(1, MONDAY)).thenReturn(List.of(existing));

        slotGenerator.generateSlotsForHorizon();

        assertThat(saved).hasSize(7);
        assertThat(saved).noneMatch(slot -> slot.getDate().equals(MONDAY) && slot.getStartTime().equals(LocalTime.of(9, 0)));
    }

    @Test
    void ignoresSchedulesForOtherWeekdays() {
        when(vetScheduleRepository.findAllWithVet()).thenReturn(List.of(aSchedule(DayOfWeek.SUNDAY)));

        slotGenerator.generateSlotsForHorizon();

        assertThat(saved).extracting(TimeSlot::getDate).containsOnly(MONDAY.plusDays(6), MONDAY.plusDays(13));
    }

    private static VetSchedule aSchedule(DayOfWeek dayOfWeek) {
        VetSchedule schedule = new VetSchedule();
        schedule.setVet(aVet());
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartTime(LocalTime.of(9, 0));
        schedule.setEndTime(LocalTime.of(11, 0));
        schedule.setSlotMinutes(30);
        return schedule;
    }

    private static Vet aVet() {
        Vet vet = new Vet();
        vet.setId(1);
        vet.setFirstName("Ana");
        vet.setLastName("Pop");
        return vet;
    }
}
