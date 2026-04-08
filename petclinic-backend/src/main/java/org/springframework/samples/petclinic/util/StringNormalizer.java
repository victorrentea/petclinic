package org.springframework.samples.petclinic.util;

import java.text.Normalizer;

public class StringNormalizer {
    /** Called by H2 via CREATE ALIAS UNACCENT */
    public static String unaccent(String input) {
        if (input == null) return null;
        return Normalizer.normalize(input, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }
}
