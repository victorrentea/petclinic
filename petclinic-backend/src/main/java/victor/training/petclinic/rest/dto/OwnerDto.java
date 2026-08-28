package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

import java.util.ArrayList;
import java.util.List;

public class OwnerDto {
    @Min(0)
    @Nullable
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the pet owner.")
    private Integer id;

    @NotNull
    @Size(min = 1, max = 30)
    @Schema(example = "George", description = "The first name of the pet owner.")
    private String firstName;

    @NotNull
    @Size(min = 1, max = 30)
    @Schema(example = "Franklin", description = "The last name of the pet owner.")
    private String lastName;

    @NotNull
    @Size(min = 1, max = 255)
    @Schema(example = "\"110 W. Liberty St.\"", description = "The postal address of the pet owner.")
    private String address;

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "Madison", description = "The city of the pet owner.")
    private String city;

    @NotNull
    @Pattern(regexp = "^[0-9]*$")
    @Size(min = 1, max = 20)
    @Schema(example = "\"6085551023\"", description = "The telephone number of the pet owner.")
    private String telephone;

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

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getTelephone() {
        return telephone;
    }

    public void setTelephone(String telephone) {
        this.telephone = telephone;
    }

    public List<PetDto> getPets() {
        return pets;
    }

    public void setPets(List<PetDto> pets) {
        this.pets = pets;
    }
}
