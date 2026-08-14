package victor.training.petclinic.rest;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.OwnerMapper;
import victor.training.petclinic.mapper.PetMapper;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import victor.training.petclinic.rest.error.UnsortableColumnException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/owners")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;
    private final PetTypeRepository petTypeRepository;

    private final OwnerMapper ownerMapper;

    private final PetMapper petMapper;

    private final VisitMapper visitMapper;

    /** Public sort names, deliberately decoupled from entity fields: "name" is two properties. */
    private static final Map<String, String[]> SORTABLE_COLUMNS = Map.of(
            "name", new String[]{"lastName", "firstName"},
            "city", new String[]{"city"},
            "petCount", new String[]{"petCount"});

    /** Largest supported size wins for anything in between; nothing else bounds the payload. */
    private static final List<Integer> SUPPORTED_PAGE_SIZES = List.of(5, 10, 20);

    /** Appended to every ordering so it is total, and paging visits each owner exactly once. */
    private static final Sort TIEBREAKER = Sort.by("lastName", "firstName", "id");

    @Operation(operationId = "listOwners", summary = "List owners, paginated and sorted",
            description = "Returns one page of owners whose last name starts with the given prefix. "
                    + "Sortable columns: name (last then first), city, petCount - each asc or desc. "
                    + "Page size is clamped into {5, 10, 20}; a page past the end is empty, "
                    + "not an error; an unsortable column is rejected with 400.")
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = OwnerPageDto.class),
                    examples = @ExampleObject(name = "sample", value = ApiExamples.OWNERS)))
    @ApiResponse(responseCode = "400", description = "Sort column or direction not supported",
            content = @Content(mediaType = "*/*", schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(produces = "application/json")
    public OwnerPageDto listOwners(
            @RequestParam(name = "lastName", defaultValue = "") String lastName,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sort", defaultValue = "name,asc") String sort) {
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), clampToSupportedSize(size), sortBy(sort));
        Page<Owner> owners = ownerRepository.findByLastNameStartingWith(lastName, pageRequest);
        return new OwnerPageDto()
                .setContent(ownerMapper.toOwnerDtoCollection(owners.getContent()))
                .setTotalElements(owners.getTotalElements())
                .setNumber(owners.getNumber())
                .setSize(owners.getSize());
    }

    /**
     * Translates a public "field,direction" instruction into an ordering, rejecting anything
     * outside the allowlist before a property name can reach the query, and appending the
     * tiebreaker - so the whole ordering rule is readable in one place.
     */
    private Sort sortBy(String sortInstruction) {
        String[] fieldAndDirection = sortInstruction.split(",", 2);
        String field = fieldAndDirection[0];
        String[] properties = SORTABLE_COLUMNS.get(field);
        if (properties == null) {
            throw new UnsortableColumnException(field, SORTABLE_COLUMNS.keySet());
        }
        Direction direction = fieldAndDirection.length == 1
                ? Direction.ASC
                : Direction.fromOptionalString(fieldAndDirection[1])
                        .orElseThrow(() -> new UnsortableColumnException(
                                fieldAndDirection[1], SORTABLE_COLUMNS.keySet()));
        return Sort.by(direction, properties).and(TIEBREAKER);
    }

    /** Largest supported size not exceeding the request; below the smallest, the smallest. */
    private int clampToSupportedSize(int requestedSize) {
        return SUPPORTED_PAGE_SIZES.stream()
                .filter(supported -> supported <= requestedSize)
                .max(Integer::compare)
                .orElse(SUPPORTED_PAGE_SIZES.get(0));
    }

    @Operation(operationId = "countOwners", summary = "Count owners")
    @GetMapping("/count")
    @PreAuthorize("permitAll()")
    public long countOwners() {
        return ownerRepository.count();
    }

    @Operation(operationId = "getOwner", summary = "Get an owner by ID")
    @GetMapping("/{ownerId}")
    public OwnerDto getOwner(@PathVariable int ownerId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        return ownerMapper.toOwnerDto(owner);
    }

    @Operation(operationId = "addOwner", summary = "Create an owner")
    @PostMapping(consumes = "application/json")
    public ResponseEntity<Void> addOwner(@RequestBody @Validated OwnerFieldsDto ownerFieldsDto) {
        Owner owner = ownerMapper.toOwner(ownerFieldsDto);
        ownerRepository.save(owner);
        URI createdUri = UriComponentsBuilder.newInstance()
                .path("/api/owners/{id}").buildAndExpand(owner.getId()).toUri();
        return ResponseEntity.created(createdUri).build();
    }

    @Operation(operationId = "updateOwner", summary = "Update an owner")
    @PutMapping("/{ownerId}")
    public void updateOwner(@PathVariable int ownerId, @RequestBody @Validated OwnerFieldsDto ownerFieldsDto) {
        Owner currentOwner = ownerRepository.findById(ownerId).orElseThrow();
        currentOwner.setAddress(ownerFieldsDto.getAddress());
        currentOwner.setCity(ownerFieldsDto.getCity());
        currentOwner.setFirstName(ownerFieldsDto.getFirstName());
        currentOwner.setLastName(ownerFieldsDto.getLastName());
        currentOwner.setTelephone(ownerFieldsDto.getTelephone());
        ownerRepository.save(currentOwner);
    }

    @Operation(operationId = "deleteOwner", summary = "Delete an owner by ID")
    @DeleteMapping("/{ownerId}")
    public void deleteOwner(@PathVariable int ownerId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        ownerRepository.delete(owner);
    }

    @Operation(operationId = "addPetToOwner", summary = "Add a pet to an owner")
    @PostMapping("{ownerId}/pets")
    @Transactional
    public ResponseEntity<Void> addPetToOwner(@PathVariable int ownerId,
            @RequestBody @Validated PetFieldsDto petFieldsDto) {
        Pet pet = petMapper.toPet(petFieldsDto);
        pet.setOwner(new Owner().setId(ownerId));
        pet.setType(petTypeRepository.findById(pet.getType().getId()).orElseThrow());
        petRepository.save(pet);
        UriComponents createdUri = UriComponentsBuilder.newInstance().path("/api/pets/{id}")
                .buildAndExpand(pet.getId());
        return ResponseEntity.created(createdUri.toUri()).build();
    }

    @Operation(operationId = "updateOwnersPet", summary = "Update an owner's pet")
    @PutMapping("{ownerId}/pets/{petId}")
    @Transactional
    public void updateOwnersPet(@PathVariable int ownerId, @PathVariable int petId,
            @RequestBody @Validated PetFieldsDto petFieldsDto) {
        Pet currentPet = petRepository.findById(petId).orElseThrow();
        currentPet.setBirthDate(petFieldsDto.getBirthDate());
        currentPet.setName(petFieldsDto.getName());
        currentPet.setType(petTypeRepository.findById(petFieldsDto.getType().getId()).orElseThrow());
        petRepository.save(currentPet);
    }

    @Operation(operationId = "addVisitToOwner", summary = "Add a visit for an owner's pet")
    @PostMapping("{ownerId}/pets/{petId}/visits")
    public ResponseEntity<Void> addVisitToOwner(@PathVariable int ownerId, @PathVariable int petId,
            @RequestBody VisitFieldsDto visitFieldsDto) {
        Visit visit = visitMapper.toVisit(visitFieldsDto);
        visit.setPet(new Pet().setId(petId));
        visitRepository.save(visit);

        URI createdUri = UriComponentsBuilder.fromPath("/api/pets/{petId}/visits/{id}")
                .buildAndExpand(petId, visit.getId()).toUri();
        return ResponseEntity.created(createdUri).build();
    }

    @Operation(operationId = "getOwnersPet", summary = "Get a pet belonging to an owner")
    @GetMapping("{ownerId}/pets/{petId}")
    public PetDto getOwnersPet(@PathVariable int ownerId, @PathVariable int petId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        Pet pet = owner.getPetById(petId).orElseThrow();
        return petMapper.toPetDto(pet);
    }
}
