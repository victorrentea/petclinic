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

    public void setId(Integer id) {
        this.id = id;
    }

    public List<PetDto> getPets() {
        return pets;
    }

    public void setPets(List<PetDto> pets) {
        this.pets = pets;
    }
}
