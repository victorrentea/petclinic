package victor.training.petclinic.notification;

import java.time.LocalDate;

/**
 * How the rest of the application reaches a pet owner. The texting itself happens in
 * notification-service, a separate process — see {@link NotificationServiceClient}.
 *
 * <p>Plain values, no entity: what crosses the wire is a phone number and something to say, never
 * an {@code Owner} that needs a session still open by the time it is read.
 */
public interface NotificationSender {

    /** Tells the owner, on the phone number given, that their pet's visit is booked. */
    void visitBooked(String ownerPhone, String petName, LocalDate visitDate);
}
