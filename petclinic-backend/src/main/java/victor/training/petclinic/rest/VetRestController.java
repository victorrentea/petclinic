package victor.training.petclinic.rest;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.SpecialtyMapper;
import victor.training.petclinic.mapper.VetMapper;
import victor.training.petclinic.domain.Specialty;
import victor.training.petclinic.domain.Vet;
import victor.training.petclinic.repository.SpecialtyRepository;
import victor.training.petclinic.repository.VetRepository;
import victor.training.petclinic.rest.dto.VetDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/vets")
@PreAuthorize("hasRole(@roles.VET_ADMIN)")
public class VetRestController {

    private final VetMapper vetMapper;
    private final SpecialtyMapper specialtyMapper;
    private final VetRepository vetRepository;
    private final SpecialtyRepository specialtyRepository;

    public VetRestController(
            VetMapper vetMapper,
            SpecialtyMapper specialtyMapper,
            VetRepository vetRepository,
            SpecialtyRepository specialtyRepository) {
        this.vetMapper = vetMapper;
        this.specialtyMapper = specialtyMapper;
        this.vetRepository = vetRepository;
        this.specialtyRepository = specialtyRepository;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = VetDto.class)),
                    examples = @ExampleObject(name = "sample", value = ApiExamples.VETS)))
    public List<VetDto> listVets() {
        List<Vet> allVets = vetRepository.findAll();
        return vetMapper.toVetDtos(allVets);
    }

    @GetMapping("{vetId}")
    public VetDto getVet(@PathVariable int vetId) {
        Vet vet = vetRepository.findById(vetId).orElseThrow();
        return vetMapper.toVetDto(vet);
    }

    @PostMapping
    public ResponseEntity<Void> addVet(@RequestBody @Validated VetDto vetDto) {
        Vet vet = vetMapper.toVet(vetDto);
        vet.setId(null); // id is server-generated; ignore any client-supplied value
        resolveManagedSpecialties(vet);
        vetRepository.save(vet);
        URI createdVetUri = UriComponentsBuilder.fromPath("/api/vets/{id}")
                .buildAndExpand(vet.getId()).toUri();
        return ResponseEntity.created(createdVetUri).build();
    }

    @PutMapping("{vetId}")
    public void updateVet(@PathVariable int vetId, @RequestBody @Validated VetDto vetDto) {
        Vet currentVet = vetRepository.findById(vetId).orElseThrow();
        currentVet.setFirstName(vetDto.getFirstName());
        currentVet.setLastName(vetDto.getLastName());
        currentVet.clearSpecialties();
        for (Specialty spec : specialtyMapper.toSpecialty(vetDto.getSpecialties())) {
            currentVet.addSpecialty(spec);
        }
        resolveManagedSpecialties(currentVet);
        vetRepository.save(currentVet);
    }

    // replaces the (possibly transient) specialties on the vet with the managed entities found by name
    private void resolveManagedSpecialties(Vet vet) {
        if (vet.getNrOfSpecialties() > 0) {
            Set<String> names = vet.getSpecialties().stream().map(Specialty::getName)
                    .collect(Collectors.toSet());
            List<Specialty> managedSpecialties = specialtyRepository.findSpecialtiesByNameIn(names);
            vet.setSpecialties(managedSpecialties);
        }
    }

    @DeleteMapping("{vetId}")
    public void deleteVet(@PathVariable int vetId) {
        Vet vet = vetRepository.findById(vetId).orElseThrow();
        vetRepository.delete(vet);
    }
}
