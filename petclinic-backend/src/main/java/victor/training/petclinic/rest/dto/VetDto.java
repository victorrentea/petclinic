package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class VetDto {

    @NotNull
    @Pattern(regexp = "\\w+")
    @Size(min = 1, max = 30)
    @Schema(example = "James", description = "The first name of the vet.")
    private String firstName;

    @NotNull
    @Pattern(regexp = "\\w+")
    @Size(min = 1, max = 30)
    @Schema(example = "Carter", description = "The last name of the vet.")
    private String lastName;

    @NotNull
    @Valid
    @Schema(description = "The specialties of the vet.")
    private List<@Valid SpecialtyDto> specialties = new ArrayList<>();

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the vet.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    public String getFirstName() {
        return firstName;
    }

    public VetDto setFirstName(String firstName) {
        this.firstName = firstName;
        return this;
    }

    public String getLastName() {
        return lastName;
    }

    public VetDto setLastName(String lastName) {
        this.lastName = lastName;
        return this;
    }

    public List<SpecialtyDto> getSpecialties() {
        return specialties;
    }

    public VetDto setSpecialties(List<SpecialtyDto> specialties) {
        this.specialties = specialties;
        return this;
    }

    public Integer getId() {
        return id;
    }

    public VetDto setId(Integer id) {
        this.id = id;
        return this;
    }
}
