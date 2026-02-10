package org.springframework.samples.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.lang.Nullable;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
public class PetDto {
    @NotBlank
    @Size(max = 30)
    @Schema(example = "Leo", description = "The name of the pet.")
    private String name;

    @NotNull
    @Valid
    @PastOrPresent(message = "{pet.birthDate.notInFuture}")
    @Schema(example = "2010-09-07")
    private LocalDate birthDate;

    @NotNull
    @Valid
    private PetTypeDto type;

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the pet.", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the pet's owner.")
    private @Nullable Integer ownerId;

    @Valid
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, description = "Vet visit bookings for this pet.", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<VisitDto> visits = new ArrayList<>();

}
