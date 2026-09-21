package victor.training.petclinic.rest;

import java.net.URI;
import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.OwnerMapper;
import victor.training.petclinic.mapper.PetMapper;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.notification.NotificationSender;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
import victor.training.petclinic.domain.VisitDateOutOfRangeException;
import victor.training.petclinic.domain.VisitDateRange;
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
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;

@RestController
@RequestMapping("/api/owners")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {

    private static final int MAX_PAGE_SIZE = 1000;

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;
    private final PetTypeRepository petTypeRepository;

    private final OwnerMapper ownerMapper;

    private final PetMapper petMapper;

    private final VisitMapper visitMapper;

    private final NotificationSender notificationSender;

    public OwnerRestController(
            OwnerRepository ownerRepository,
            PetRepository petRepository,
            VisitRepository visitRepository,
            PetTypeRepository petTypeRepository,
            OwnerMapper ownerMapper,
            PetMapper petMapper,
            VisitMapper visitMapper,
            NotificationSender notificationSender) {
        this.ownerRepository = ownerRepository;
        this.petRepository = petRepository;
        this.visitRepository = visitRepository;
        this.petTypeRepository = petTypeRepository;
        this.ownerMapper = ownerMapper;
        this.petMapper = petMapper;
        this.visitMapper = visitMapper;
        this.notificationSender = notificationSender;
    }

    // useReturnTypeSchema: keep springdoc's schema for Page<OwnerDto> and only add the example —
    // spelling a schema out here would replace it with a hand-maintained twin.
    @Operation(operationId = "listOwners", summary = "List owners, one page at a time")
    @ApiResponse(responseCode = "200", description = "OK", useReturnTypeSchema = true,
            content = @Content(mediaType = "application/json",
                    examples = @ExampleObject(name = "sample", value = ApiExamples.OWNERS)))
    @GetMapping(produces = "application/json")
    public Page<OwnerDto> listOwners(
            @Parameter(description = "Prefix of the last name to filter by") //
            @RequestParam(name = "lastName", defaultValue = "") String lastName,
            @Parameter(description = "Zero-based page index, 0 or greater") //
            @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Owners per page, between 1 and 1000") //
            @RequestParam(name = "size", defaultValue = "10") int size,
            @Parameter(description = "<key>,<asc|desc> where key is one of: name, city") //
            @RequestParam(name = "sort", defaultValue = "name,asc") String sort) {
        checkPagingBounds(page, size);
        PageRequest pageRequest = PageRequest.of(page, size, OwnerSortField.parseSort(sort));
        Page<Owner> owners = ownerRepository.findByLastNameStartingWith(lastName, pageRequest);
        return owners.map(ownerMapper::toOwnerDto);
    }

    /**
     * Same reason the sort key is whitelisted: a client-supplied number must not reach a 500 thrown
     * from inside {@code PageRequest.of}. Checked before any query runs. The upper bound is
     * inclusive — the browser suite pulls the whole clinic with {@code ?size=1000} for its fixtures.
     */
    private static void checkPagingBounds(int page, int size) {
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page index must be 0 or greater, but was " + page + ".");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page size must be between 1 and " + MAX_PAGE_SIZE + ", but was " + size + ".");
        }
    }

    /**
     * The two columns a clinic user may order the grid by. Binding a raw {@code Pageable} instead
     * would let a caller sort by {@code pets.name} — Spring adds the join silently — or by a typo,
     * which surfaces as a 500 from deep inside JPA. This is also where {@code name} expands to the
     * two columns it actually means.
     */
    enum OwnerSortField {
        NAME("lastName", "firstName"), //
        CITY("city");

        private final String[] columns;

        OwnerSortField(String... columns) {
            this.columns = columns;
        }

        /**
         * Parses {@code <key>,<asc|desc>} and closes the ordering with the id. Equal keys would
         * otherwise come back in any order per query, so under LIMIT/OFFSET the same owner could
         * land on two pages or none — which is why the caller never gets to omit the tiebreak.
         */
        static Sort parseSort(String sortParam) {
            String[] parts = sortParam.split(",", 2);
            OwnerSortField field = named(parts[0]);
            return Sort.by(directionIn(parts), field.columns).and(Sort.by("id"));
        }

        private static Sort.Direction directionIn(String[] parts) {
            if (parts.length < 2) {
                return Sort.Direction.ASC;
            }
            return Sort.Direction.fromOptionalString(parts[1])
                    .orElseThrow(() -> badRequest(
                            "Unknown sort direction '" + parts[1] + "'. Use 'asc' or 'desc'."));
        }

        private static OwnerSortField named(String key) {
            for (OwnerSortField field : values()) {
                if (field.name().equalsIgnoreCase(key)) {
                    return field;
                }
            }
            throw badRequest("Cannot sort owners by '" + key + "'. Sortable columns: name, city.");
        }

        private static ResponseStatusException badRequest(String message) {
            return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
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
            @RequestBody @Validated VisitFieldsDto visitFieldsDto) {
        int visitId = bookVisit(ownerId, petId, visitFieldsDto);

        URI createdUri = UriComponentsBuilder.fromPath("/api/pets/{petId}/visits/{id}")
                .buildAndExpand(petId, visitId).toUri();
        return ResponseEntity.created(createdUri).build();
    }

    // Explicit span so the booking step shows up in the Tempo trace — and in the sequence
    // diagram generated from it — beside the auto-instrumented SERVER and JDBC spans, which
    // on their own say "a POST happened, an INSERT happened" and never name the step.
    // The OTel Java agent instruments @WithSpan at the bytecode level, so it works on a
    // private, self-invoked method (Spring AOP would not) — keeping the repository-only,
    // no-service-layer house style.
    @WithSpan("book-visit")
    private int bookVisit(int ownerId, int petId, VisitFieldsDto visitFieldsDto) {
        Pet pet = petRepository.findById(petId).orElseThrow();
        VisitDateRange allowed = VisitDateRange.forPetBornOn(pet.getBirthDate(), LocalDate.now());
        if (!allowed.allows(visitFieldsDto.getDate())) {
            throw new VisitDateOutOfRangeException(visitFieldsDto.getDate(), allowed);
        }
        Visit visit = visitMapper.toVisit(visitFieldsDto);
        visit.setPet(pet);
        visitRepository.save(visit);
        notifyOwner(ownerId, petId, visit);
        return visit.getId();
    }

    // After the insert, never before: a booking that could not be saved is a text nobody
    // should have received. The owner is loaded here and not in the module — a notifier that
    // reaches for a repository is a notifier that needs a database.
    private void notifyOwner(int ownerId, int petId, Visit visit) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        String petName = owner.getPetById(petId).map(Pet::getName).orElse("your pet");
        notificationSender.visitBooked(owner.getTelephone(), petName, visit.getDate());
    }

    @Operation(operationId = "getOwnersPet", summary = "Get a pet belonging to an owner")
    @GetMapping("{ownerId}/pets/{petId}")
    public PetDto getOwnersPet(@PathVariable int ownerId, @PathVariable int petId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        Pet pet = owner.getPetById(petId).orElseThrow();
        return petMapper.toPetDto(pet);
    }
}
