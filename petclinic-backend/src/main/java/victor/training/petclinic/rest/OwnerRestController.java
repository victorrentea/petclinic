package victor.training.petclinic.rest;

import java.net.URI;
import java.util.List;
import java.util.Set;



import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.OwnerMapper;
import victor.training.petclinic.mapper.PetMapper;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.Visit;
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/owners")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {

    enum SortField { NAME, CITY }

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;
    private final PetTypeRepository petTypeRepository;

    private final OwnerMapper ownerMapper;

    private final PetMapper petMapper;

    private final VisitMapper visitMapper;

    private static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);

    @Operation(
        operationId = "listOwners",
        summary = "List owners",
        description = """
            Returns a paginated list of pet owners. Optionally filter by a free-text search term \
            that matches first name, last name, or city (case-insensitive, partial match). \
            Example: GET /api/owners?q=davis&page=0&size=10&sort=NAME&dir=ASC\
            """
    )
    @Parameter(name = "q",    description = "Free-text filter on first name, last name, or city (partial, case-insensitive). Omit to return all owners.", example = "Davis")
    @Parameter(name = "page", description = "Zero-based page index.", example = "0")
    @Parameter(name = "size", description = "Page size. Allowed values: 5, 10, 20.", example = "10")
    @Parameter(name = "sort", description = "Sort field. NAME = sort by first+last name; CITY = sort by city then name.", example = "NAME")
    @Parameter(name = "dir",  description = "Sort direction: ASC or DESC.", example = "ASC")
    @GetMapping(produces = "application/json")
    public ResponseEntity<OwnerPageDto> listOwners(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "NAME") SortField sort,
            @RequestParam(defaultValue = "ASC") Sort.Direction dir) {
        if (!ALLOWED_SIZES.contains(size)) {
            return ResponseEntity.badRequest().build();
        }
        // sort=NAME → firstName, lastName (matches displayed "First Last" order)
        // sort=CITY → city, firstName, lastName
        PageRequest pageable;
        if (sort == SortField.CITY) {
            pageable = PageRequest.of(page, size, Sort.by(dir, "city").and(Sort.by("firstName", "lastName")));
        } else {
            pageable = PageRequest.of(page, size, Sort.by(dir, "firstName", "lastName"));
        }

        Page<Owner> ownerPage = ownerRepository.search(q, pageable);

        OwnerPageDto result = new OwnerPageDto();
        result.setContent(ownerMapper.toOwnerDtoCollection(ownerPage.getContent()));
        result.setTotalElements(ownerPage.getTotalElements());
        return ResponseEntity.ok(result);
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
    public void updateOwnersPet(@PathVariable int ownerId, @PathVariable int petId, @RequestBody PetFieldsDto petFieldsDto) {
        Pet currentPet = petRepository.findById(petId).orElseThrow();
        currentPet.setBirthDate(petFieldsDto.getBirthDate());
        currentPet.setName(petFieldsDto.getName());
        currentPet.setType(petMapper.toPetType(petFieldsDto.getType()));
        currentPet.setType(petTypeRepository.findById(currentPet.getType().getId()).orElseThrow());
        petRepository.save(currentPet);
    }

    @Operation(operationId = "addVisitToOwner", summary = "Add a visit for an owner's pet")
    @PostMapping("{ownerId}/pets/{petId}/visits")
    public ResponseEntity<Void> addVisitToOwner(@PathVariable int ownerId, @PathVariable int petId, @RequestBody VisitFieldsDto visitFieldsDto) {
        Visit visit = visitMapper.toVisit(visitFieldsDto);
        Pet pet = new Pet();
        pet.setId(petId);
        visit.setPet(pet);
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
