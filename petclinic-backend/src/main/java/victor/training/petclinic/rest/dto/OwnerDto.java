package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.lang.Nullable;

import java.util.ArrayList;
import java.util.List;

public class OwnerDto extends OwnerFieldsDto {
    @Min(0)
    @Nullable
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the pet owner.")
    private Integer id;

    @Valid
    @Schema(accessMode = Schema.AccessMode.READ_ONLY,
            description = "The pets owned by this individual including any booked vet visits.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private List<PetDto> pets = new ArrayList<>();

    public OwnerDto addPetsItem(PetDto petsItem) {
        pets.add(petsItem);
        return this;
    }

    public Integer getId() {
        return id;
    }

    public OwnerDto setId(Integer id) {
        this.id = id;
        return this;
    }

    public List<PetDto> getPets() {
        return pets;
    }

    public OwnerDto setPets(List<PetDto> pets) {
        this.pets = pets;
        return this;
    }

    // Covariant overrides: keep the OwnerDto type while chaining the inherited setters.
    @Override
    public OwnerDto setFirstName(String firstName) {
        super.setFirstName(firstName);
        return this;
    }

    @Override
    public OwnerDto setLastName(String lastName) {
        super.setLastName(lastName);
        return this;
    }

    @Override
    public OwnerDto setAddress(String address) {
        super.setAddress(address);
        return this;
    }

    @Override
    public OwnerDto setCity(String city) {
        super.setCity(city);
        return this;
    }

    @Override
    public OwnerDto setTelephone(String telephone) {
        super.setTelephone(telephone);
        return this;
    }
}
