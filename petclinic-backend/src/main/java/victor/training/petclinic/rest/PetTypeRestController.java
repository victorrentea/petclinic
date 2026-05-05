package victor.training.petclinic.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.PetTypeMapper;
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.rest.dto.PetTypeDto;
import victor.training.petclinic.rest.dto.PetTypeFieldsDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/pettypes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole(@roles.OWNER_ADMIN, @roles.VET_ADMIN)")
public class PetTypeRestController {

    private final PetTypeMapper petTypeMapper;
    private final PetTypeRepository petTypeRepository;

    @GetMapping(produces = "application/json")
    public List<PetTypeDto> listPetTypes() {
        List<PetType> petTypes = new ArrayList<>(petTypeRepository.findAll());
        return petTypeMapper.toPetTypeDtos(petTypes);
    }

    @GetMapping("/{petTypeId}")
    public PetTypeDto getPetType(@PathVariable int petTypeId) {
        PetType petType = petTypeRepository.findById(petTypeId).orElseThrow();
        return petTypeMapper.toPetTypeDto(petType);
    }

    @PreAuthorize("hasRole(@roles.VET_ADMIN)")
    @PostMapping(consumes = "application/json")
    public ResponseEntity<Void> addPetType(@RequestBody @Validated PetTypeFieldsDto petTypeFieldsDto) {
        PetType type = petTypeMapper.toPetType(petTypeFieldsDto);
        petTypeRepository.save(type);
        URI createdUri = UriComponentsBuilder.fromPath("/api/pettypes/{id}")
            .buildAndExpand(type.getId()).toUri();
        return ResponseEntity.created(createdUri).build();
    }

    @PreAuthorize("hasRole(@roles.VET_ADMIN)")
    @PutMapping("/{petTypeId}")
    public void updatePetType(@PathVariable int petTypeId,
                              @RequestBody @Validated PetTypeDto petTypeDto) {
        PetType currentPetType = petTypeRepository.findById(petTypeId).orElseThrow();
        currentPetType.setName(petTypeDto.getName());
        petTypeRepository.save(currentPetType);
    }

    @PreAuthorize("hasRole(@roles.VET_ADMIN)")
    @DeleteMapping("/{petTypeId}")
    public ResponseEntity<Void> deletePetType(@PathVariable int petTypeId) {
        try {
            PetType petType = petTypeRepository.findById(petTypeId).orElseThrow();
            petTypeRepository.delete(petType);
            return ResponseEntity.noContent().build();
        } catch (DataIntegrityViolationException ex) {
            throw new RuntimeException("PetType is in use by existing pets and cannot be deleted", ex);
        }
    }

}
