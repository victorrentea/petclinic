package victor.training.petclinic.rest.error;

/** Raised when a visit is booked into a slot another visit already claims. */
public class SlotAlreadyBookedException extends RuntimeException {

    public SlotAlreadyBookedException(int timeSlotId) {
        super("Time slot " + timeSlotId + " is already booked");
    }
}
