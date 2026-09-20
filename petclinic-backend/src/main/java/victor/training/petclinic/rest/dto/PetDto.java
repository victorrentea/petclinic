package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class PetDto {
    @NotBlank
    @Size(max = 30)
    @Schema(example = "Leo", description = "The name of the pet.")
    private String name;

    @NotNull
    @Valid
    @PastOrPresent(message = "Birth date must not be in the future")
    @Schema(example = "2010-09-07")
    private LocalDate birthDate;

    @NotNull
    @Valid
    private PetTypeDto type;

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the pet.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the pet's owner.")
    private @Nullable Integer ownerId;

    @Valid
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Vet visit bookings for this pet.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private List<VisitDto> visits = new ArrayList<>();

    public String getName() {
        return name;
    }

    public PetDto setName(String name) {
        this.name = name;
        return this;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public PetDto setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
        return this;
    }

    public PetTypeDto getType() {
        return type;
    }

    public PetDto setType(PetTypeDto type) {
        this.type = type;
        return this;
    }

    public Integer getId() {
        return id;
    }

    public PetDto setId(Integer id) {
        this.id = id;
        return this;
    }

    public Integer getOwnerId() {
        return ownerId;
    }

    public PetDto setOwnerId(Integer ownerId) {
        this.ownerId = ownerId;
        return this;
    }

    public List<VisitDto> getVisits() {
        return visits;
    }

    public PetDto setVisits(List<VisitDto> visits) {
        this.visits = visits;
        return this;
    }
}
