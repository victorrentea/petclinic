package victor.training.commons;

import java.time.LocalDate;

/**
 * What petclinic-backend POSTs to notification-service after a visit is booked.
 *
 * <p>Both sides compile against this one class, so the path and the payload cannot drift apart
 * silently — the price is that neither can be released without the other once this changes.
 */
public record VisitBookedNotification(String ownerPhone, String petName, LocalDate visitDate) {

    public static final String PATH = "/api/notifications/visit-booked";
}
