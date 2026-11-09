package victor.training.petclinic.rest.dto;

import java.util.List;

/** One row of the Owners grid: only what it displays, so a page never drags in visits. */
public record OwnerRowDto(int id, String firstName, String lastName, String address, String city, String telephone,
        List<PetRowDto> pets) {

    public record PetRowDto(String name, String type) {
    }
}
