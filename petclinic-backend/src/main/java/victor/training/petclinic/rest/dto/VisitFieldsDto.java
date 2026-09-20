package victor.training.petclinic.rest.dto;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.lang.Nullable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class VisitFieldsDto {

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    @Valid
    @Schema(example = "2013-01-01", description = "The date of the visit.")
    private @Nullable LocalDate date;

    @NotNull
    @Size(min = 1, max = 255)
    @Schema(example = "rabies shot", description = "The description for the visit.")
    private String description;

    // Absent and explicitly null mean the same thing here — no vet — so that clearing the
    // field in the edit form persists as empty instead of silently keeping the old vet.
    @Min(0)
    @Schema(example = "1", description = "The ID of the vet attending the visit; null for none.")
    private @Nullable Integer vetId;

    public LocalDate getDate() {
        return date;
    }

    public VisitFieldsDto setDate(LocalDate date) {
        this.date = date;
        return this;
    }

    public String getDescription() {
        return description;
    }

    public VisitFieldsDto setDescription(String description) {
        this.description = description;
        return this;
    }

    public Integer getVetId() {
        return vetId;
    }

    public VisitFieldsDto setVetId(Integer vetId) {
        this.vetId = vetId;
        return this;
    }
}
