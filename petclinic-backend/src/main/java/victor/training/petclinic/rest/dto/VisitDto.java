package victor.training.petclinic.rest.dto;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.lang.Nullable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class VisitDto {

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    @Valid
    @Schema(example = "2013-01-01", description = "The date of the visit.")
    private @Nullable LocalDate date;

    @NotNull
    @Size(min = 1, max = 255)
    @Schema(example = "rabies shot", description = "The description for the visit.")
    private String description;

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the visit.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @NotNull
    @Min(0)
    @Schema(example = "1", description = "The ID of the pet.")
    private Integer petId;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Name of the pet (server-populated).")
    private @Nullable String petName;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "ID of the owner of the pet (server-populated).")
    private @Nullable Integer ownerId;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "First name of the owner (server-populated).")
    private @Nullable String ownerFirstName;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Last name of the owner (server-populated).")
    private @Nullable String ownerLastName;

    public LocalDate getDate() {
        return date;
    }

    public VisitDto setDate(LocalDate date) {
        this.date = date;
        return this;
    }

    public String getDescription() {
        return description;
    }

    public VisitDto setDescription(String description) {
        this.description = description;
        return this;
    }

    public Integer getId() {
        return id;
    }

    public VisitDto setId(Integer id) {
        this.id = id;
        return this;
    }

    public Integer getPetId() {
        return petId;
    }

    public VisitDto setPetId(Integer petId) {
        this.petId = petId;
        return this;
    }

    public String getPetName() {
        return petName;
    }

    public VisitDto setPetName(String petName) {
        this.petName = petName;
        return this;
    }

    public Integer getOwnerId() {
        return ownerId;
    }

    public VisitDto setOwnerId(Integer ownerId) {
        this.ownerId = ownerId;
        return this;
    }

    public String getOwnerFirstName() {
        return ownerFirstName;
    }

    public VisitDto setOwnerFirstName(String ownerFirstName) {
        this.ownerFirstName = ownerFirstName;
        return this;
    }

    public String getOwnerLastName() {
        return ownerLastName;
    }

    public VisitDto setOwnerLastName(String ownerLastName) {
        this.ownerLastName = ownerLastName;
        return this;
    }
}
