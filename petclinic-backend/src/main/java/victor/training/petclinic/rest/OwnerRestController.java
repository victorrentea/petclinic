package victor.training.petclinic.rest;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.data.util.TypeInformation;
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
import victor.training.petclinic.rest.dto.PageDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
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

    /**
     * The properties a client may sort by, mapped to the rest of their sort chain.
     * <p>
     * Address and telephone are deliberately absent: address is free text starting with a house
     * number, so sorting it reads {@code 14…, 221B…, 26…, 30…, 4…} — correct for text and a defect
     * to every human who sees it; telephone has no consistent format. A sort that produces nonsense
     * is read as a broken feature rather than as a limitation.
     */
    private static final Map<String, List<String>> SORT_CHAINS = Map.of(
        "lastName", List.of("lastName", "firstName"),
        "city", List.of("city", "lastName"));

    private static final Sort DEFAULT_SORT = Sort.by("lastName");

    @Operation(operationId = "listOwners", summary = "List owners, one page at a time")
    // The response schema is deliberately left to springdoc to infer from the return type: naming a
    // schema explicitly erases the generic, publishing content as an untyped array and generating
    // `unknown[]` in the frontend's api-types.ts. A typed contract beats a hand-written example.
    @ApiResponse(responseCode = "200", description = "OK")
    @GetMapping(produces = "application/json")
    public PageDto<OwnerDto> listOwners(
        @RequestParam(name = "lastName", defaultValue = "") String lastName,
        @ParameterObject Pageable pageable) {
        Pageable totallyOrdered = PageRequest.of(
            pageable.getPageNumber(), pageable.getPageSize(), toTotalOrder(pageable.getSort()));
        Page<Owner> page = ownerRepository.findByLastNameStartingWith(lastName, totallyOrdered);
        return PageDto.of(page, ownerMapper.toOwnerDtoCollection(page.getContent()));
    }

    /**
     * Turns whatever the client asked for into a <i>total</i> order: expands each sortable property
     * into its full chain and always appends {@code id}.
     * <p>
     * Page stability is a correctness property of the server, not something every client must
     * remember to ask for. No sortable column is unique — {@code city} is London ×7 in the seed
     * alone — and over a non-unique {@code ORDER BY} the database may legally break ties differently
     * per request, which shows one owner on two consecutive pages while skipping another.
     * <p>
     * The {@code id} tiebreaker follows the sort's direction rather than a hard-coded {@code ASC}.
     * Our expanded chains are single-direction, so an all-{@code DESC} order plus {@code id ASC}
     * would be neither a forward nor a backward walk of the all-{@code ASC} composite index —
     * forcing an extra sort step. Matching {@code id} to the direction lets one index serve every
     * page by a plain forward or backward scan (verified by {@code EXPLAIN} at 10k rows: an
     * Incremental Sort becomes a pure Index Scan Backward). Either direction is equally stable.
     */
    private Sort toTotalOrder(Sort requested) {
        Sort expanded = Sort.unsorted();
        Sort.Direction tiebreakDirection = Sort.Direction.ASC;
        for (Sort.Order order : requested.isSorted() ? requested : DEFAULT_SORT) {
            List<String> chain = SORT_CHAINS.get(order.getProperty());
            if (chain == null) {
                throw new PropertyReferenceException(order.getProperty(),
                    TypeInformation.of(Owner.class), List.of());
            }
            expanded = expanded.and(Sort.by(order.getDirection(), chain.toArray(String[]::new)));
            tiebreakDirection = order.getDirection();
        }
        return expanded.and(Sort.by(tiebreakDirection, "id"));
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
    public ResponseEntity<Void> addPetToOwner(@PathVariable int ownerId, @RequestBody @Validated PetFieldsDto petFieldsDto) {
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
    public void updateOwnersPet(@PathVariable int ownerId, @PathVariable int petId, @RequestBody @Validated PetFieldsDto petFieldsDto) {
        Pet currentPet = petRepository.findById(petId).orElseThrow();
        currentPet.setBirthDate(petFieldsDto.getBirthDate());
        currentPet.setName(petFieldsDto.getName());
        currentPet.setType(petTypeRepository.findById(petFieldsDto.getType().getId()).orElseThrow());
        petRepository.save(currentPet);
    }

    @Operation(operationId = "addVisitToOwner", summary = "Add a visit for an owner's pet")
    @PostMapping("{ownerId}/pets/{petId}/visits")
    public ResponseEntity<Void> addVisitToOwner(@PathVariable int ownerId, @PathVariable int petId, @RequestBody VisitFieldsDto visitFieldsDto) {
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
