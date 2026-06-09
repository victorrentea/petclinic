package victor.training.petclinic.chatbot;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * A LOCAL Spring AI tool (vs the remote MCP tools) that pretends to email the authenticated owner.
 * The recipient address is NOT taken from the model — it is read from the security context
 * (the email claim of the Bearer JWT the web page sent), so the model can't email anyone else.
 */
@Slf4j
@Component
class EmailTool {

  @Tool(description = "Email the authenticated pet owner (e.g. a visit confirmation). "
      + "The recipient is always the logged-in owner — do not pass an address.")
  String sendEmail(
      @ToolParam(description = "email subject line") String subject,
      @ToolParam(description = "email body text") String body) {
    String to = OwnerContext.email();
    if (to == null || to.isBlank()) {
      return "No authenticated owner email available — cannot send.";
    }
    // Demo only — no real email is sent; we just pretend and log it.
    log.info("📧 (demo) sent email to {} — subject: \"{}\"", to, subject);
    return "Email sent to " + to;
  }
}
