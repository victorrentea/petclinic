package victor.training.petclinic;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import victor.training.petclinic.repository.OwnerRepository;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static victor.training.petclinic.TransactionOutcomeTracing.OUTCOME;

/**
 * Against the transaction manager Spring Boot builds, so it also proves the listener is
 * registered on it: a bean nobody hands to the manager would pass a unit test and stamp nothing.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class TransactionOutcomeTracingTest {
    @Autowired
    PlatformTransactionManager transactionManager;
    @Autowired
    OwnerRepository ownerRepository;

    final Span span = mock(Span.class);

    @BeforeEach
    void theMockIsTheCurrentSpan() {
        when(span.storeInContext(any())).thenCallRealMethod();
    }

    private void inSpan(Runnable call) {
        try (Scope ignored = Context.root().with(span).makeCurrent()) {
            call.run();
        }
    }

    @Test
    void aRepositoryCallStampsCommittedOnItsSpan() {
        inSpan(() -> ownerRepository.findById(1));

        verify(span).setAttribute(OUTCOME, "committed");
    }

    @Test
    void aTransactionThatRollsBackSaysRolledBack() {
        inSpan(() -> new TransactionTemplate(transactionManager)
                .executeWithoutResult(TransactionStatus::setRollbackOnly));

        verify(span).setAttribute(OUTCOME, "rolled back");
        verify(span, never()).setAttribute(OUTCOME, "committed");
    }
}
