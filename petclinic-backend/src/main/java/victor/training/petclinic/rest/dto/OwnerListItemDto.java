package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The slim shape returned by the owners list endpoint — no nested pet visits/types, since the
 * grid only ever shows a pet's name. See {@code openspec/changes/add-owners-pagination}.
 */
@Schema(description = "A summary of a pet owner, as shown in the paginated owners list.")
public class OwnerListItemDto {

    @Schema(example = "1", description = "The ID of the pet owner.")
    private Integer id;

    @Schema(example = "\"George\"")
    private String firstName;

    @Schema(example = "\"Franklin\"")
    private String lastName;

    @Schema(example = "\"110 W. Liberty St.\"")
    private String address;

    @Schema(example = "\"Madison\"")
    private String city;

    @Schema(example = "\"6085551023\"")
    private String telephone;

    @Schema(description = "The names of the pets owned by this individual.")
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
