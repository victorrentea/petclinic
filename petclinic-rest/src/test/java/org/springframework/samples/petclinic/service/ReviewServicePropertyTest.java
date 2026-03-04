package org.springframework.samples.petclinic.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Property-based tests for ReviewService using JUnit parameterized tests.
 * These tests verify universal properties that should hold for all inputs.
 */
class ReviewServicePropertyTest {

    /**
     * Create a ReviewService instance for testing.
     * We pass null for dependencies since we're only testing sanitizeFeedback
     * which doesn't use the repository or mapper.
     */
    private ReviewService createReviewService() {
        return new ReviewService(null, null);
    }

    /**
     * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
     *
     * Property 17: XSS input sanitization
     *
     * This property verifies that the OWASP HTML Sanitizer removes all malicious content
     * from user input, protecting against XSS attacks.
     *
     * The test uses various malicious inputs containing:
     * - HTML tags (script, img, div, etc.)
     * - Event handlers (onclick, onerror, etc.)
     * - Special characters
     *
     * And verifies that the sanitized output:
     * - Contains no HTML tags
     * - Contains no script tags
     * - Contains no event handlers
     * - Is safe plain text
     */
    @ParameterizedTest
    @MethodSource("maliciousInputs")
    void sanitizeFeedback_removesAllMaliciousContent(String maliciousInput) {
        // Given: a ReviewService instance
        ReviewService reviewService = createReviewService();

        // When: sanitizing potentially malicious input
        String sanitized = reviewService.sanitizeFeedback(maliciousInput);

        // Then: the output should be safe plain text with no HTML tags or malicious content
        assertThat(sanitized)
            .as("Sanitized output should not contain script tags")
            .doesNotContainIgnoringCase("<script");

        assertThat(sanitized)
            .as("Sanitized output should not contain closing script tags")
            .doesNotContainIgnoringCase("</script>");

        assertThat(sanitized)
            .as("Sanitized output should not contain img tags")
            .doesNotContainIgnoringCase("<img");

        assertThat(sanitized)
            .as("Sanitized output should not contain iframe tags")
            .doesNotContainIgnoringCase("<iframe");

        assertThat(sanitized)
            .as("Sanitized output should not contain onclick handlers")
            .doesNotContainIgnoringCase("onclick");

        assertThat(sanitized)
            .as("Sanitized output should not contain onerror handlers")
            .doesNotContainIgnoringCase("onerror");

        assertThat(sanitized)
            .as("Sanitized output should not contain onload handlers")
            .doesNotContainIgnoringCase("onload");

        // Verify no HTML tags remain (basic check for < followed by letter)
        assertThat(sanitized)
            .as("Sanitized output should not contain HTML tag patterns")
            .doesNotContainPattern("<[a-zA-Z]");
    }

    /**
     * Provides malicious input strings containing various XSS attack vectors.
     */
    static Stream<String> maliciousInputs() {
        return Stream.of(
            // Script tags
            "<script>alert('xss')</script>",
            "<script>document.cookie</script>",
            "<script src='evil.js'></script>",
            "<SCRIPT>alert('XSS')</SCRIPT>",
            "<script>alert(String.fromCharCode(88,83,83))</script>",
            
            // Image tags with event handlers
            "<img src=x onerror=alert('xss')>",
            "<img src='x' onerror='alert(1)'>",
            "<img/src='x'/onerror='alert(1)'>",
            "<IMG SRC=javascript:alert('XSS')>",
            
            // Event handlers
            "<div onclick='alert(1)'>Click me</div>",
            "<body onload=alert('xss')>",
            "<input onfocus=alert('xss') autofocus>",
            "<select onfocus=alert('xss') autofocus>",
            "<textarea onfocus=alert('xss') autofocus>",
            
            // Iframe tags
            "<iframe src='javascript:alert(1)'></iframe>",
            "<iframe src='data:text/html,<script>alert(1)</script>'></iframe>",
            
            // Other HTML tags
            "<b>bold text</b>",
            "<div>content</div>",
            "<a href='http://evil.com'>link</a>",
            "<style>body{background:red}</style>",
            "<link rel='stylesheet' href='evil.css'>",
            
            // Special characters
            "Test & special < characters >",
            "Quote \" and apostrophe '",
            "Mixed <tag> & \"quotes\" with 'apostrophes'",
            
            // Combined attacks
            "<script>malicious</script>alert('xss')",
            "<div><script>nested</script></div>",
            "Text before <script>alert('xss')</script> text after"
        );
    }

    /**
     * Additional property: Sanitization should handle plain text gracefully without crashing.
     */
    @ParameterizedTest
    @ValueSource(strings = {
        "Plain text without any HTML",
        "Text with numbers 12345",
        "Text with punctuation!@#$%",
        "Multi\nline\ntext",
        "Text with tabs\t\there",
        "Very long text that goes on and on and on to test handling of longer strings without any HTML tags"
    })
    void sanitizeFeedback_handlesPlainTextWithoutCrashing(String plainText) {
        // Given: a ReviewService instance
        ReviewService reviewService = createReviewService();

        // When: sanitizing the text
        String sanitized = reviewService.sanitizeFeedback(plainText);

        // Then: should not crash and should return a non-null result
        assertThat(sanitized).isNotNull();
    }

    /**
     * Additional property: Sanitization should handle null and empty strings gracefully.
     * Note: OWASP sanitizer trims whitespace, so "   " becomes "".
     */
    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "  \t  ", "\n", "\r\n"})
    void sanitizeFeedback_handlesNullAndEmpty(String input) {
        // Given: a ReviewService instance
        ReviewService reviewService = createReviewService();
        
        // When: sanitizing null or empty input
        String sanitized = reviewService.sanitizeFeedback(input);

        // Then: should return null for null, empty for empty/whitespace
        if (input == null) {
            assertThat(sanitized).isNull();
        } else {
            // OWASP sanitizer trims whitespace
            assertThat(sanitized).isEmpty();
        }
    }
}
