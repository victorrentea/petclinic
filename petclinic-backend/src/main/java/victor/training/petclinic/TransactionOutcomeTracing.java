package victor.training.petclinic;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionExecution;
import org.springframework.transaction.TransactionExecutionListener;

/**
 * Stamps how each transaction ended on the span of the call that began it.
 *
 * <p>The OpenTelemetry agent records a commit (Hibernate's {@code Transaction.commit} span) but
 * nothing at all for a rollback, so a traced sequence diagram could frame a transaction that
 * committed and showed none for one that rolled back. Spring calls this after every transaction
 * it began, while the call that began it (a repository method: nothing here is
 * {@code @Transactional}) is still the current span; petclinic-test's trace-to-puml.ts writes
 * the outcome beside that frame's {@code tx}. Spring Boot hands every such listener bean to the
 * transaction manager it configures. Without the agent the current span is a no-op, and so is
 * this.
 */
@Component
class TransactionOutcomeTracing implements TransactionExecutionListener {
    static final AttributeKey<String> OUTCOME = AttributeKey.stringKey("transaction.outcome");

    @Override
    public void afterCommit(TransactionExecution transaction, @Nullable Throwable commitFailure) {
        Span.current().setAttribute(OUTCOME, commitFailure == null ? "committed" : "commit failed");
    }

    @Override
    public void afterRollback(TransactionExecution transaction, @Nullable Throwable rollbackFailure) {
        Span.current().setAttribute(OUTCOME, "rolled back");
    }
}
