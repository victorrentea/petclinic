package org.springframework.samples.petclinic.rest;

import java.net.URI;
import java.text.Normalizer;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.mapper.OwnerMapper;
import org.springframework.samples.petclinic.mapper.PetMapper;
import org.springframework.samples.petclinic.mapper.VisitMapper;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.Visit;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.samples.petclinic.repository.VisitRepository;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.OwnerFieldsDto;
import org.springframework.samples.petclinic.rest.dto.OwnerPageDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetFieldsDto;
import org.springframework.samples.petclinic.rest.dto.VisitFieldsDto;
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
import org.springframework.data.web.PageableDefault;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/owners")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController implements OwnerRestApi {

    private static final int DEFAULT_PAGE_NUMBER = 0;
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;
    private final PetTypeRepository petTypeRepository;

    private final OwnerMapper ownerMapper;

    private final PetMapper petMapper;

    private final VisitMapper visitMapper;

    @Override
    @GetMapping(produces = "application/json")
    public OwnerPageDto listOwners(
        @RequestParam(name = "query", required = false) String query,
        @PageableDefault(size = DEFAULT_PAGE_SIZE) Pageable pageable
    ) {
        PageRequest pageRequest = PageRequest.of(
            pageable.getPageNumber(),
            validatedPageSize(pageable.getPageSize()),
            toSort(pageable.getSort())
        );
        Page<Owner> owners;
        if (query != null && !query.isBlank()) {
            owners = ownerRepository.searchOwners(normalizeQuery(query), pageRequest);
        } else {
            owners = ownerRepository.findAll(pageRequest);
        }
        return new OwnerPageDto(
            ownerMapper.toOwnerDtoCollection(owners.getContent()),
            owners.getTotalElements(),
            owners.getTotalPages(),
            owners.getNumber(),
            owners.getSize()
        );
    }

    private String normalizeQuery(String query) {
        // Strip combining diacritical marks so "t" matches "ț", "a" matches "ă", etc.
        String nfd = Normalizer.normalize(query, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }

    private int validatedPageSize(int size) {
        if (size == 10 || size == 20) {
            return size;
        }
        throw new ResponseStatusException(BAD_REQUEST, "Unsupported page size: " + size);
    }

    private Sort toSort(Sort requestedSort) {
        if (requestedSort.isUnsorted()) {
            return Sort.by(Sort.Direction.ASC, "lastName", "firstName", "id");
        }

        if (requestedSort.toList().size() != 1) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported sort: " + requestedSort);
        }

        Sort.Order requestedOrder = requestedSort.toList().get(0);
        Sort.Direction direction = requestedOrder.getDirection();

        return switch (requestedOrder.getProperty()) {
            case "name" -> Sort.by(direction, "lastName", "firstName").and(Sort.by(Sort.Direction.ASC, "id"));
            case "city" -> Sort.by(direction, "city").and(Sort.by(Sort.Direction.ASC, "id"));
            default -> throw new ResponseStatusException(BAD_REQUEST, "Unsupported sort: " + requestedSort);
        };
    }

    @Override
    @GetMapping("/{ownerId}")
    public OwnerDto getOwner(@PathVariable int ownerId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        return ownerMapper.toOwnerDto(owner);
    }

    @Override
    @PostMapping(consumes = "application/json")
    public ResponseEntity<Void> addOwner(@RequestBody @Validated OwnerFieldsDto ownerFieldsDto) {
        Owner owner = ownerMapper.toOwner(ownerFieldsDto);
        ownerRepository.save(owner);
        URI createdUri = UriComponentsBuilder.newInstance()
            .path("/api/owners/{id}").buildAndExpand(owner.getId()).toUri();
        return ResponseEntity.created(createdUri).build();
    }

    @Override
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

    @Override
    @DeleteMapping("/{ownerId}")
    public void deleteOwner(@PathVariable int ownerId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        ownerRepository.delete(owner);
    }

    @Override
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

    @Override
    @PutMapping("{ownerId}/pets/{petId}")
    public void updateOwnersPet(@PathVariable int ownerId, @PathVariable int petId, @RequestBody PetFieldsDto petFieldsDto) {
        Pet currentPet = petRepository.findById(petId).orElseThrow();
        currentPet.setBirthDate(petFieldsDto.getBirthDate());
        currentPet.setName(petFieldsDto.getName());
        currentPet.setType(petMapper.toPetType(petFieldsDto.getType()));
        currentPet.setType(petTypeRepository.findById(currentPet.getType().getId()).orElseThrow());
        petRepository.save(currentPet);
    }

    @Override
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

    @Override
    @GetMapping("{ownerId}/pets/{petId}")
    public PetDto getOwnersPet(@PathVariable int ownerId, @PathVariable int petId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        Pet pet = owner.getPetById(petId).orElseThrow();
        return petMapper.toPetDto(pet);
    }
}
