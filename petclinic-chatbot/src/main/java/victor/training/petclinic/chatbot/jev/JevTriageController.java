package victor.training.petclinic.chatbot.jev;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The same triage as {@code PetTriageAgent}, but asked to Jev: no prompt, no prose to parse.
 * The question carries the answer's Java type — an enum comes back as that enum, a yes/no as a probability.
 */
@RestController
class JevTriageController {

    enum Specialty {
        RADIOLOGY, SURGERY, DENTISTRY
    }

    private final Jev jev;

    JevTriageController(Jev jev) {
        this.jev = jev;
    }

    // GET /jev?symptom=My dog swallowed a sock and keeps vomiting
    @GetMapping(value = "/jev", produces = "text/plain")
    String triage(@RequestParam String symptom) {
        Specialty specialty = jev.choose(symptom, "Which vet specialty should see this pet?", Specialty.class);
        double emergency = jev.probability(symptom, "Does this pet need emergency care right now?");

        String next = switch (specialty) {
            case RADIOLOGY -> "book an X-ray";
            case SURGERY -> "book a surgeon";
            case DENTISTRY -> "book a dental check";
        };
        if (emergency > 0.8) {
            next += " — TODAY, it's an emergency";
        }
        return "%s (emergency: %.2f) → %s".formatted(specialty, emergency, next);
    }
}
