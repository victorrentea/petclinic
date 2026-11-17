package victor.training.petclinic.rest;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
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
import victor.training.petclinic.rest.dto.OwnerPageDto;
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

import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;

@RestController
@RequestMapping("/api/owners")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {

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

    @Operation(operationId = "listOwners", summary = "List owners",
            description = "One page of owners, globally sorted and filtered by last-name prefix "
                    + "(case-sensitive, wildcard characters taken literally). Names and cities sort "
                    + "ignoring case in Romanian alphabetical order; ties break by ID. "
                    + "A valid page beyond the last one returns empty content with accurate totals.",
            parameters = {
                    @Parameter(name = "page", in = ParameterIn.QUERY, description = "Zero-based page number.",
                            schema = @Schema(type = "integer", minimum = "0", defaultValue = "0")),
                    @Parameter(name = "size", in = ParameterIn.QUERY, description = "Page size; defaults to 10.",
                            schema = @Schema(type = "integer", allowableValues = {"5", "10", "20"})),
                    @Parameter(name = "sort", in = ParameterIn.QUERY,
                            description = "One sort, as <field>,<asc|desc>; field is lastName (then first name) "
                                    + "or city.",
                            schema = @Schema(type = "string", defaultValue = "lastName,asc",
                                    allowableValues = {"lastName,asc", "lastName,desc", "city,asc", "city,desc"})),
                    @Parameter(name = "lastName", in = ParameterIn.QUERY,
                            description = "Only owners whose last name starts with this text.",
                            schema = @Schema(type = "string", defaultValue = ""))})
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = OwnerPageDto.class),
                    examples = @ExampleObject(name = "sample", value = ApiExamples.OWNERS_PAGE)))
    @ApiResponse(responseCode = "400",
            description = "A malformed, negative, duplicated or unsupported page, size, sort or direction",
            content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(produces = "application/json")
    public OwnerPageDto listOwners(@Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
        OwnerListQuery query = OwnerListQuery.from(params);
        List<Integer> pageIds = ownerRepository.findIdsPage(
                query.lastName(), query.sort(), query.size(), query.offset());
        long totalElements = ownerRepository.countByLastNamePrefix(query.lastName());
        return new OwnerPageDto()
                .setContent(ownersInOrder(pageIds))
                .setTotalElements(totalElements)
                .setTotalPages((int) ((totalElements + query.size() - 1) / query.size()))
                .setNumber(query.page())
                .setSize(query.size());
    }

    private List<OwnerDto> ownersInOrder(List<Integer> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Integer, Owner> ownersById = ownerRepository.findWithPetsAndVisitsByIdIn(ids).stream()
                .collect(Collectors.toMap(Owner::getId, Function.identity()));
        return ownerMapper.toOwnerDtoCollection(ids.stream().map(ownersById::get).filter(Objects::nonNull).toList());
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
            @RequestBody VisitFieldsDto visitFieldsDto) {
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
        Visit visit = visitMapper.toVisit(visitFieldsDto);
        Pet pet = petRepository.findById(petId).orElseThrow();
        pet.checkVisitDate(visit.getDate());
        visit.setPet(pet);
        visitRepository.save(visit);
        notifyOwner(ownerId, petId, visit);
        return visit.getId();
    }

    // After the insert, never before: a booking that could not be saved is a text nobody
    // should have received. The owner is loaded here, not in notification-service — which
    // then needs no copy of our database.
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
