package victor.training.petclinic.scheduling;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/** Expands one day's opening hours into back-to-back slot start times. */
public final class SlotPlan {

    private SlotPlan() {
    }

    /**
     * The start time of every whole slot that fits between {@code from} and {@code to}. A trailing
     * remainder shorter than {@code slotMinutes} is dropped, and hours that would run past midnight
     * stop at midnight rather than wrapping into the next day.
     */
    public static List<LocalTime> startTimes(LocalTime from, LocalTime to, int slotMinutes) {
        if (slotMinutes <= 0) {
            throw new IllegalArgumentException("slotMinutes must be positive, was " + slotMinutes);
        }
        List<LocalTime> startTimes = new ArrayList<>();
        LocalTime start = from;
        while (true) {
            LocalTime end = start.plusMinutes(slotMinutes);
            if (!end.isAfter(start) || end.isAfter(to)) {
                return startTimes;
            }
            startTimes.add(start);
            start = end;
        }
    }
}
