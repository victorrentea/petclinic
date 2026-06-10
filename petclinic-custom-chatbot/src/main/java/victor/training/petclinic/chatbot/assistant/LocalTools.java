package victor.training.petclinic.chatbot.assistant;

import java.time.LocalDateTime;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * The LOCAL Spring AI tools (vs the remote MCP tools), exposed to the assistant alongside them:
 * <ul>
 *   <li>a clock, so relative times ("now", "in 1 hour", "tomorrow") resolve reliably instead of
 *       being guessed by the model;</li>
 *   <li>an email sender to the authenticated owner. The recipient is NOT taken from the model — it
 *       is injected via the {@link ToolContext} (the {@code ownerEmail} the controller put there
 *       from the security principal), so the model can't email anyone else.</li>
 * </ul>
 */
@Slf4j
@Component
class LocalTools {

  /** ToolContext key under which the controller publishes the authenticated owner's email. */
  static final String OWNER_EMAIL = "ownerEmail";

  @Tool(description = "Returns the current local date and time (ISO-8601, e.g. 2026-06-09T23:33). "
      + "Call it to resolve relative times like 'now', 'in 1 hour' or 'tomorrow' — never guess the time.")
  String currentDateTime() {
    return LocalDateTime.now().withNano(0).toString();
  }

  @Tool(description = "Email the authenticated pet owner (e.g. a visit confirmation). "
      + "The recipient is always the logged-in owner — do not pass an address.  ")
  String sendEmail(
      @ToolParam(description = "email subject line: example [TICKET-123] Brief Description") String subject,
      @ToolParam(description = "email body text") String body,
      ToolContext toolContext) {
    // Shape guard: subject MUST start with a [TAG] prefix. Throwing feeds the message back to the agent, which retries.
    if (!subject.matches("^\\[TICKET-\\d+].*")) {
        log.error("REJECTED subject: "+ subject);
        // TODO 🦄 : check that ticket # acutally exists in JIRA
        throw new IllegalArgumentException("Subject must start with a [TICKET-<number>] prefix, e.g. [TICKET-123] Brief Description");
    }

    String to = ((OwnerJwtPrincipal)SecurityContextHolder.getContext().getAuthentication().getPrincipal()).email();
    // Injected by the controller from the security principal — never supplied by the model.
//    Object to = toolContext.getContext().get(OWNER_EMAIL);
    if (to == null || to.toString().isBlank()) {
      return "No authenticated owner email available — cannot send.";
    }
    // Demo only — no real email is sent; we just pretend and log it.
    log.info("📧 (demo) sent email to {} — subject: \"{}\" — body: \"{}\"", to, subject, body);
    return "Email sent to " + to;
  }
}
