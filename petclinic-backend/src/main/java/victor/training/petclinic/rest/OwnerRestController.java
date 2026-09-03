package victor.training.petclinic.rest;

import java.net.URI;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.web.PagedModel;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.OwnerMapper;
import victor.training.petclinic.mapper.PetMapper;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerRowDto;
import victor.training.petclinic.rest.dto.OwnerRowPage;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
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
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/owners")
@Validated
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {
    /** Protects the endpoint at 100.000 owners: the UI's 5/10/20 selector is a convention, not a guarantee. */
    static final int MAX_PAGE_SIZE = 20;

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;
    private final PetTypeRepository petTypeRepository;

    private final OwnerMapper ownerMapper;

    private final PetMapper petMapper;

    private final VisitMapper visitMapper;
    private final VisitDateRange visitDateRange;

    public OwnerRestController(
            OwnerRepository ownerRepository,
            PetRepository petRepository,
            VisitRepository visitRepository,
            PetTypeRepository petTypeRepository,
            OwnerMapper ownerMapper,
            PetMapper petMapper,
            VisitMapper visitMapper,
            VisitDateRange visitDateRange) {
        this.ownerRepository = ownerRepository;
        this.petRepository = petRepository;
        this.visitRepository = visitRepository;
        this.petTypeRepository = petTypeRepository;
        this.ownerMapper = ownerMapper;
        this.petMapper = petMapper;
        this.visitMapper = visitMapper;
        this.visitDateRange = visitDateRange;
    }

    /**
     * The fields the owners grid can be ordered by.
     * <p>
     * An enum rather than a raw {@code Pageable}: a Pageable would accept any entity property, so
     * {@code sort=telephone} or {@code sort=pets.name} would trigger an unindexed sort over the whole
     * table. Every ordering ends in {@code id} because last names are not unique -- without a unique
     * tie-breaker, LIMIT/OFFSET may return one row on two consecutive pages and skip another.
     */
    public enum SortField {
        NAME(Sort.by("lastName", "firstName", "id")), CITY(Sort.by("city", "id"));

        private final Sort ascending;

        SortField(Sort ascending) {
            this.ascending = ascending;
        }

        Sort towards(Direction direction) {
            return direction.isDescending() ? ascending.descending() : ascending;
        }
    }

    @Operation(operationId = "listOwners", summary = "List one page of owners")
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = OwnerRowPage.class),
                    examples = @ExampleObject(name = "sample", value = ApiExamples.OWNERS)))
    @GetMapping(produces = "application/json")
    public PagedModel<OwnerRowDto> listOwners(
            @RequestParam(name = "lastName", defaultValue = "") String lastName,
            @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(name = "size", defaultValue = "10") @Min(1) @Max(MAX_PAGE_SIZE) int size,
            @RequestParam(name = "sort", defaultValue = "NAME") SortField sort,
            @RequestParam(name = "dir", defaultValue = "ASC") Direction dir) {
        PageRequest pageRequest = PageRequest.of(page, size, sort.towards(dir));
        return new PagedModel<>(ownerRepository.findByLastNameStartingWith(lastName, pageRequest)
                .map(ownerMapper::toOwnerRowDto));
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
        Owner owner = new Owner();
        owner.setId(ownerId);
        pet.setOwner(owner);
        pet.setType(resolvePetType(petFieldsDto.getType()));
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
        currentPet.setType(resolvePetType(petFieldsDto.getType()));
        petRepository.save(currentPet);
    }

    @Operation(operationId = "addVisitToOwner", summary = "Add a visit for an owner's pet")
    @PostMapping("{ownerId}/pets/{petId}/visits")
    public ResponseEntity<Void> addVisitToOwner(@PathVariable int ownerId, @PathVariable int petId,
            @RequestBody @Validated VisitFieldsDto visitFieldsDto) {
        Pet pet = petRepository.findById(petId).orElseThrow();
        visitDateRange.check(visitFieldsDto.getDate(), pet);
        Visit visit = visitMapper.toVisit(visitFieldsDto);
        visit.setPet(pet);
        visitRepository.save(visit);

        URI createdUri = UriComponentsBuilder.fromPath("/api/pets/{petId}/visits/{id}")
                .buildAndExpand(petId, visit.getId()).toUri();
        return ResponseEntity.created(createdUri).build();
    }

    /**
     * The pet type as the database knows it. @Validated already rejects a body without a type, so
     * the guard is unreachable over HTTP -- but it states the invariant where the dereference is,
     * instead of leaving a NullPointerException as the answer to a direct call.
     */
    private PetType resolvePetType(PetTypeDto typeDto) {
        if (typeDto == null || typeDto.getId() == null) {
            throw new IllegalArgumentException("A pet must have a type");
        }
        return petTypeRepository.findById(typeDto.getId()).orElseThrow();
    }

    @Operation(operationId = "getOwnersPet", summary = "Get a pet belonging to an owner")
    @GetMapping("{ownerId}/pets/{petId}")
    public PetDto getOwnersPet(@PathVariable int ownerId, @PathVariable int petId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        Pet pet = owner.getPetById(petId).orElseThrow();
        return petMapper.toPetDto(pet);
    }
}
