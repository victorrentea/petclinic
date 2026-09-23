package victor.training.notification;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.commons.VisitBookedNotification;

@WebMvcTest(NotificationController.class)
class NotificationControllerTest {
    @Autowired
    MockMvc mockMvc;
    @MockitoBean
    SmsGateway smsGateway;

    @Test
    void textsTheOwnerWhenAVisitIsBooked() throws Exception {
        mockMvc.perform(post(VisitBookedNotification.PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ownerPhone": "6085551023", "petName": "Leo", "visitDate": "2026-10-01"}"""))
                .andExpect(status().isAccepted());

        verify(smsGateway).send("6085551023", "Visit for Leo booked on 2026-10-01. Reply STOP to unsubscribe.");
    }
}
