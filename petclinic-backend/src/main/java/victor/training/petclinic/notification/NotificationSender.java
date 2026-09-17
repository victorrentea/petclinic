package victor.training.petclinic.notification;

import java.time.LocalDate;

/**
 * The Notification module's whole surface: how the rest of the application reaches a pet owner.
 *
 * <p>An interface rather than the sender itself, so nothing outside the package knows an SMS is
 * what happens next — and so the call can be instrumented as a hop <em>into</em> a module instead
 * of one more method in the caller. See {@link FakeSmsNotificationSender} for how that hop is
 * drawn.
 *
 * <p>Plain values, no entity: a module that takes an {@code Owner} needs the domain model, the
 * repositories and a session still open by the time it runs. What it actually needs is a phone
 * number and something to say.
 */
public interface NotificationSender {

    /** Tells the owner, on the phone number given, that their pet's visit is booked. */
    void visitBooked(String ownerPhone, String petName, LocalDate visitDate);
}
