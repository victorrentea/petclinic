package victor.training.petclinic.chatbot;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/** A LOCAL Spring AI tool (vs the remote MCP tools) that pretends to send the owner an email. */
@Slf4j
@Component
class EmailTool {

  @Tool(description = "Send an email to the pet owner, e.g. a visit confirmation or reminder.")
  String sendEmail(
      @ToolParam(description = "recipient email address") String to,
      @ToolParam(description = "email subject line") String subject,
      @ToolParam(description = "email body text") String body) {
    // Demo only — no real email is sent; we just pretend and log it.
    log.info("📧 (demo) sent email to {} — subject: \"{}\"", to, subject);
    return "Email sent to " + to;
  }
}
