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

    @Min(0)
    @Schema(example = "1", description = "The ID of the vet that attended the visit.")
    private @Nullable Integer vetId;

    public @Nullable LocalDate getDate() {
        return date;
    }

    public void setDate(@Nullable LocalDate date) {
        this.date = date;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public @Nullable Integer getVetId() {
        return vetId;
    }

    public void setVetId(@Nullable Integer vetId) {
        this.vetId = vetId;
    }
}
