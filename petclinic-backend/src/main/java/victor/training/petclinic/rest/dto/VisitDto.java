package victor.training.petclinic.rest.dto;

import java.time.LocalDate;
import java.time.LocalTime;
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

    @Min(0)
    @Schema(example = "1", description = "The ID of the vet seeing the pet. Null on visits with no vet assigned.")
    private @Nullable Integer vetId;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Name of the vet (server-populated).")
    private @Nullable String vetName;

    @Min(0)
    @Schema(example = "1", description = "The slot to book. When set, the visit takes the slot's vet, date and time.")
    private @Nullable Integer timeSlotId;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, type = "string", example = "09:00:00",
            description = "Start time of the booked slot (server-populated).")
    private @Nullable LocalTime startTime;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "ID of the owner of the pet (server-populated).")
    private @Nullable Integer ownerId;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "First name of the owner (server-populated).")
    private @Nullable String ownerFirstName;

    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Last name of the owner (server-populated).")
    private @Nullable String ownerLastName;

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
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

    public String getPetName() {
        return petName;
    }

    public void setPetName(String petName) {
        this.petName = petName;
    }

    public Integer getVetId() {
        return vetId;
    }

    public void setVetId(Integer vetId) {
        this.vetId = vetId;
    }

    public String getVetName() {
        return vetName;
    }

    public void setVetName(String vetName) {
        this.vetName = vetName;
    }

    public Integer getTimeSlotId() {
        return timeSlotId;
    }

    public void setTimeSlotId(Integer timeSlotId) {
        this.timeSlotId = timeSlotId;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public Integer getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Integer ownerId) {
        this.ownerId = ownerId;
    }

    public String getOwnerFirstName() {
        return ownerFirstName;
    }

    public void setOwnerFirstName(String ownerFirstName) {
        this.ownerFirstName = ownerFirstName;
    }

    public String getOwnerLastName() {
        return ownerLastName;
    }

    public void setOwnerLastName(String ownerLastName) {
        this.ownerLastName = ownerLastName;
    }
}
