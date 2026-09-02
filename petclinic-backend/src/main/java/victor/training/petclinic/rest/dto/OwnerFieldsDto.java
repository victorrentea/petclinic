package victor.training.petclinic.rest.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class OwnerFieldsDto {

    @NotNull
    @Size(min = 1, max = 30)
    @Schema(example = "\"George\"", description = "The first name of the pet owner.")
    private String firstName;

    @NotNull
    @Size(min = 1, max = 30)
    @Schema(example = "\"Franklin\"", description = "The last name of the pet owner.")
    private String lastName;

    @NotNull
    @Size(min = 1, max = 255)
    @Schema(example = "\"110 W. Liberty St.\"", description = "The postal address of the pet owner.")
    private String address;

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "\"Madison\"", description = "The city of the pet owner.")
    private String city;

    @NotNull
    @Pattern(regexp = "^[0-9]*$")
    @Size(min = 1, max = 20)
    @Schema(example = "\"6085551023\"", description = "The telephone number of the pet owner.")
    private String telephone;

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
}
