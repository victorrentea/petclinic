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

    @Min(0)
    @Schema(example = "1", description = "The ID of the vet that attended the visit.")
    private @Nullable Integer vetId;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "First name of the vet (server-populated).")
    private @Nullable String vetFirstName;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Last name of the vet (server-populated).")
    private @Nullable String vetLastName;

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

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getPetId() {
        return petId;
    }

    public void setPetId(Integer petId) {
        this.petId = petId;
    }

    public @Nullable String getPetName() {
        return petName;
    }

    public void setPetName(@Nullable String petName) {
        this.petName = petName;
    }

    public @Nullable Integer getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(@Nullable Integer ownerId) {
        this.ownerId = ownerId;
    }

    public @Nullable String getOwnerFirstName() {
        return ownerFirstName;
    }

    public void setOwnerFirstName(@Nullable String ownerFirstName) {
        this.ownerFirstName = ownerFirstName;
    }

    public @Nullable String getOwnerLastName() {
        return ownerLastName;
    }

    public void setOwnerLastName(@Nullable String ownerLastName) {
        this.ownerLastName = ownerLastName;
    }

    public @Nullable Integer getVetId() {
        return vetId;
    }

    public void setVetId(@Nullable Integer vetId) {
        this.vetId = vetId;
    }

    public @Nullable String getVetFirstName() {
        return vetFirstName;
    }

    public void setVetFirstName(@Nullable String vetFirstName) {
        this.vetFirstName = vetFirstName;
    }

    public @Nullable String getVetLastName() {
        return vetLastName;
    }

    public void setVetLastName(@Nullable String vetLastName) {
        this.vetLastName = vetLastName;
    }
}
