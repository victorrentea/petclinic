package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class VetFieldsDto {

    @NotNull
    @Pattern(regexp = "^\\p{L}+([ '-][\\p{L}]+){0,2")
    @Size(min = 1, max = 30)
    @Schema(example = "James", description = "The first name of the vet.")
    private String firstName;

    @NotNull
    @Pattern(regexp = "^\\p{L}+([ '-][\\p{L}]+){0,2}\\.")
    @Size(min = 1, max = 30)
    @Schema(example = "Carter", description = "The last name of the vet.")
    private String lastName;

    @NotNull
    @Valid
    @Schema(description = "The specialties of the vet.")
    private List<@Valid SpecialtyDto> specialties = new ArrayList<>();

    public String getFirstName() {
        return firstName;
    }

    public VetFieldsDto setFirstName(String firstName) {
        this.firstName = firstName;
        return this;
    }

    public String getLastName() {
        return lastName;
    }

    public VetFieldsDto setLastName(String lastName) {
        this.lastName = lastName;
        return this;
    }

    public List<SpecialtyDto> getSpecialties() {
        return specialties;
    }

    public VetFieldsDto setSpecialties(List<SpecialtyDto> specialties) {
        this.specialties = specialties;
        return this;
    }
}
