package victor.training.petclinic.notification;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import victor.training.commons.HomeCountry;
import victor.training.commons.PhoneNumbers;
import victor.training.commons.VisitBookedNotification;

/** POSTs to notification-service; path and payload come from petclinic-commons, shared with it. */
@Component
public class NotificationServiceClient implements NotificationSender, HomeCountry {
    private static final Logger log = LoggerFactory.getLogger(NotificationServiceClient.class);

    private final RestClient restClient;

    public NotificationServiceClient(RestClient.Builder builder,
            @Value("${notification-service.url}") String baseUrl) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    // Best effort: the visit is already saved, and an owner not texted is no reason to tell the
    // clinic its booking failed.
    @Override
    public void visitBooked(String ownerPhone, String petName, LocalDate visitDate) {
        try {
            restClient.post()
                    .uri(VisitBookedNotification.PATH)
                    .body(new VisitBookedNotification(PhoneNumbers.normalize(ownerPhone, this), petName, visitDate))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.warn("Owner not notified of the visit booked for {}: {}", petName, e.getMessage());
        }
    }

    /** The clinic's own country: an owner's number typed without a prefix is dialled from here. */
    @Override
    public String homeDialCode() {
        return "+1";
    }
}
