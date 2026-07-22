package victor.training.petclinic.rest;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import victor.training.petclinic.mapper.PetMapper;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.rest.dto.PetDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pets")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class PetRestController {

    private final PetRepository petRepository;
    private final PetMapper petMapper;

    @GetMapping("/{petId}")
    public PetDto getPet(@PathVariable int petId) {
        return petMapper.toPetDto(petRepository.findById(petId).orElseThrow());
    }

    @GetMapping(produces = "application/json")
    @ApiResponse(responseCode = "200", description = "OK",
        content = @Content(mediaType = "application/json",
            array = @ArraySchema(schema = @Schema(implementation = PetDto.class)),
            examples = @ExampleObject(name = "sample", value = ApiExamples.PETS)))
    public List<PetDto> listPets() {
        List<Pet> allPets = petRepository.findAll();
        return petMapper.toPetsDto(allPets);
    }

    @PutMapping("/{petId}")
    @Transactional
    public void updatePet(@PathVariable int petId, @Validated @RequestBody PetDto petDto) {
        Pet currentPet = petRepository.findById(petId).orElseThrow();
        currentPet
            .setBirthDate(petDto.getBirthDate())
            .setName(petDto.getName())
            .setType(petMapper.toPetType(petDto.getType()));
    }

    @DeleteMapping("/{petId}")
    public void deletePet(@PathVariable int petId) {
        Pet pet = petRepository.findById(petId).orElseThrow();
        petRepository.delete(pet);
    }

}
