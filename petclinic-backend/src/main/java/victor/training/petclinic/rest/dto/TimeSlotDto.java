package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.time.LocalTime;

public class TimeSlotDto {

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the slot.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @NotNull
    @Min(0)
    @Schema(example = "1", description = "The ID of the vet the slot belongs to.")
    private Integer vetId;

    @NotNull
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    @Schema(example = "2026-09-01", description = "The day the slot is on.")
    private LocalDate date;

    @NotNull
    @DateTimeFormat(iso = DateTimeFormat.ISO.TIME)
    @Schema(type = "string", example = "09:00:00", description = "When the slot starts.")
    private LocalTime startTime;

    @NotNull
    @DateTimeFormat(iso = DateTimeFormat.ISO.TIME)
    @Schema(type = "string", example = "09:30:00", description = "When the slot ends.")
    private LocalTime endTime;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getVetId() {
        return vetId;
    }

    public void setVetId(Integer vetId) {
        this.vetId = vetId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }
}
