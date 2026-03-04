package org.springframework.samples.petclinic.rest.error;

import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;

import java.util.ArrayList;
import java.util.List;

public final class ValidationErrorFieldExtractor {

    private ValidationErrorFieldExtractor() {}

    public static List<String> extract(BindingResult bindingResult) {
        List<String> result = new ArrayList<>();
        if (bindingResult == null) return result;
        for (FieldError fe : bindingResult.getFieldErrors()) {
            String field = humanizePath(fe.getField());
            String message = fe.getDefaultMessage() == null ? "" : fe.getDefaultMessage().trim();
            Object rejected = fe.getRejectedValue();
            String val = rejected == null ? "null" : rejected.toString();

            String combined;
            String msgLower = message.toLowerCase();
            String fieldLower = field.toLowerCase();
            if (!fieldLower.isEmpty() && msgLower.startsWith(fieldLower)) {
                combined = capitalizeFirst(message);
            } else if (message.isEmpty()) {
                combined = field;
            } else {
                combined = field + " " + message;
            }

            result.add(combined + " (value: " + val + ")");
        }
        return result;
    }

    private static String humanizePath(String path) {
        if (path == null || path.isEmpty()) return "Value";
        String single = path.replaceAll("([a-z])([A-Z])", "$1 $2");
        single = single.replace('.', ' ').trim();
        if (single.isEmpty()) return "Value";
        String[] parts = single.split("\\s+");
        for (int i = 0; i < parts.length; i++) parts[i] = parts[i].toLowerCase();
        parts[0] = Character.toUpperCase(parts[0].charAt(0)) + (parts[0].length() > 1 ? parts[0].substring(1) : "");
        return String.join(" ", parts);
    }

    private static String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + (s.length() > 1 ? s.substring(1) : "");
    }
}
