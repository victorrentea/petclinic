package org.springframework.samples.petclinic.rest.error;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

import java.util.ArrayList;
import java.util.List;

/**
 * Utility to extract and format validation errors into human-readable messages.
 */
public final class ValidationErrorExtractor {

    private ValidationErrorExtractor() {
        // utility
    }

    public static List<String> extract(ConstraintViolationException ex) {
        List<String> result = new ArrayList<>();
        if (ex == null || ex.getConstraintViolations() == null) {
            return result;
        }
        for (ConstraintViolation<?> v : ex.getConstraintViolations()) {
            String path = v.getPropertyPath() == null ? "" : v.getPropertyPath().toString();
            String message = v.getMessage() == null ? "" : v.getMessage().trim();
            Object invalid = v.getInvalidValue();
            String invalidVal = invalid == null ? "null" : invalid.toString();
            String readablePath = humanizePath(path);

            String combined;
            String msgLower = message.toLowerCase();
            String pathLower = readablePath.toLowerCase();
            if (!pathLower.isEmpty() && msgLower.startsWith(pathLower)) {
                // message already contains the field name, use message as-is (but capitalize first letter)
                combined = capitalizeFirst(message);
            } else if (message.isEmpty()) {
                combined = readablePath;
            } else {
                combined = readablePath + " " + message;
            }

            // append invalid value for debugging (kept for now)
            combined = combined + " (value: " + invalidVal + ")";

            result.add(combined);
        }
        return result;
    }

    private static String humanizePath(String path) {
        if (path == null || path.isEmpty()) {
            return "Value";
        }
        // split camelCase and dots into words
        String single = path.replace('.', ' ')
            .replaceAll("([a-z])([A-Z])", "$1 $2");
        single = single.trim();
        if (single.isEmpty()) {
            return "Value";
        }
        // lowercase all words, then capitalize first word only: "Birth date"
        String[] parts = single.split("\\s+");
        for (int i = 0; i < parts.length; i++) {
            parts[i] = parts[i].toLowerCase();
        }
        parts[0] = Character.toUpperCase(parts[0].charAt(0)) + (parts[0].length() > 1 ? parts[0].substring(1) : "");
        return String.join(" ", parts);
    }

    private static String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + (s.length() > 1 ? s.substring(1) : "");
    }
}
