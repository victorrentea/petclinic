package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

/**
 * One row of the paged owners grid ({@code GET /api/owners}). Unlike {@link OwnerDto} it never
 * carries visits — only the owner's pet names, so the list stays cheap at 100k owners.
 */
public class OwnerListItemDto {
    @Schema(example = "1", description = "The ID of the pet owner.")
    private Integer id;

    @Schema(example = "George", description = "The owner's first name.")
    private String firstName;

    @Schema(example = "Franklin", description = "The owner's last name.")
    private String lastName;

    @Schema(example = "\"110 W. Liberty St.\"", description = "The owner's address.")
    private String address;

    @Schema(example = "Madison", description = "The owner's city.")
    private String city;

    @Schema(example = "\"6085551023\"", description = "The owner's telephone number.")
    private String telephone;

    @Schema(description = "The names of the owner's pets, sorted alphabetically.")
    private List<String> petNames = new ArrayList<>();

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

    public List<String> getPetNames() {
        return petNames;
    }

    public void setPetNames(List<String> petNames) {
        this.petNames = petNames;
    }
}
