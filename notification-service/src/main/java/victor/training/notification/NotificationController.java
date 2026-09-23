package victor.training.notification;

import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import victor.training.commons.VisitBookedNotification;

@RestController
public class NotificationController {
    private final SmsGateway smsGateway;

    public NotificationController(SmsGateway smsGateway) {
        this.smsGateway = smsGateway;
    }

    @PostMapping(VisitBookedNotification.PATH)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void visitBooked(@RequestBody @Validated VisitBookedNotification notification) {
        smsGateway.send(notification.ownerPhone(), "Visit for %s booked on %s. Reply STOP to unsubscribe."
                .formatted(notification.petName(), notification.visitDate()));
    }
}
