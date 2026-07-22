package victor.training.petclinic.mcp;

import java.util.function.Consumer;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import org.springaicommunity.mcp.context.McpSyncRequestContext;
import org.springaicommunity.mcp.context.StructuredElicitResult;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class CallVetAmbulanceToolTest {

    @Autowired PetClinicMcp petClinicMcp;

    @Test
    void dispatches_ambulance_when_owner_accepts_and_provides_address() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.ACCEPT,
                new PetClinicMcp.AmbulanceAddressInput("110 Sesame Street"), null));

        String result = petClinicMcp.callVetAmbulance(context);

        assertThat(result).isEqualTo("Vet ambulance dispatched to 110 Sesame Street");
    }

    @Test
    void declined_request_does_not_dispatch() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.DECLINE, null, null));

        String result = petClinicMcp.callVetAmbulance(context);

        assertThat(result).isEqualTo("Vet ambulance was not requested.");
    }

    @Test
    void cancelled_request_does_not_dispatch() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.CANCEL, null, null));

        String result = petClinicMcp.callVetAmbulance(context);

        assertThat(result).isEqualTo("Vet ambulance was not requested.");
    }

    @Test
    void blank_address_is_rejected() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.ACCEPT,
                new PetClinicMcp.AmbulanceAddressInput("   "), null));

        assertThatThrownBy(() -> petClinicMcp.callVetAmbulance(context))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("address is required");
    }

    @Test
    void null_structured_content_is_rejected() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.ACCEPT, null, null));

        assertThatThrownBy(() -> petClinicMcp.callVetAmbulance(context))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("address is required");
    }

    @Test
    void null_context_means_no_elicitation_support() {
        assertThatThrownBy(() -> petClinicMcp.callVetAmbulance(null))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("elicitation");
    }

    @Test
    void elicitation_disabled_means_no_elicitation_support() {
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);
        when(context.elicitEnabled()).thenReturn(false);

        assertThatThrownBy(() -> petClinicMcp.callVetAmbulance(context))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("elicitation");
    }

    @SuppressWarnings("unchecked")
    private static McpSyncRequestContext elicitingContext(
            StructuredElicitResult<PetClinicMcp.AmbulanceAddressInput> r) {
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);
        when(context.elicitEnabled()).thenReturn(true);
        when(context.elicit(any(Consumer.class), any(Class.class))).thenReturn((StructuredElicitResult) r);
        return context;
    }
}
