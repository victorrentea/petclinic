package victor.training.petclinic.rest.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Global Exception handler for REST controllers.
 * <p>
 * This class handles exceptions thrown by REST controllers and returns appropriate HTTP responses to the client.
 * <p>
 * Scoped to the {@code rest} package on purpose: the MCP Streamable-HTTP endpoint ({@code /mcp}) replies on an
 * already-committed {@code text/event-stream} response. If this advice were applied there, it would try to write a
 * {@link ProblemDetail} body onto that stream — for which there is no converter — throwing
 * {@code HttpMessageNotWritableException} and corrupting the JSON-RPC exchange. Keeping it package-scoped lets the
 * MCP transport serialize tool failures into proper JSON-RPC errors itself.
 */
@Slf4j
@RestControllerAdvice(basePackages = "victor.training.petclinic.rest")
public class ExceptionControllerAdvice {

    private ProblemDetail buildProblemDetail(String title, String detail, HttpStatus status,
            HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatus(status);
        pd.setTitle(title);
          pd.setDetail(detail);
        pd.setType(java.net.URI.create(request.getRequestURL().toString()));
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex,
            HttpServletRequest request) {
        List<String> errors = ValidationErrorExtractor.extract(ex);
        log.warn("Validation failed: {}", errors);
        ProblemDetail pd = buildProblemDetail("Validation Error",
            "Validation failed for request. See 'errors' for details.", HttpStatus.BAD_REQUEST, request);
        pd.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(pd);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ProblemDetail> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        BindingResult bindingResult = ex.getBindingResult();
        // reuse ValidationErrorExtractor style: build list of readable messages
        List<String> errors = ValidationErrorFieldExtractor.extract(bindingResult);
        log.warn("Validation failed: {}", errors);
        ProblemDetail pd = buildProblemDetail("Validation Error",
            "Validation failed for request. See 'errors' for details.", HttpStatus.BAD_REQUEST, request);
        pd.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(pd);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseEntity<ProblemDetail> handleGeneralException(Exception e, HttpServletRequest request) {
        log.error("An unexpected error occurred: {}", e.getMessage(), e);
        ProblemDetail pd = buildProblemDetail(e.getMessage(),
            e.getMessage(),
            HttpStatus.INTERNAL_SERVER_ERROR, request);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(pd);
    }

    // map NoSuchElementException to a 404 Not Found response
    @ExceptionHandler(NoSuchElementException.class)
    @ResponseStatus(NOT_FOUND)
    public String handleNoSuchElementException() {
        log.error("Not found!");
        return "Not found!";
    }

}
