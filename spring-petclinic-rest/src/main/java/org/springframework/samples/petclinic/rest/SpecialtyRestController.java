package org.springframework.samples.petclinic.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.mapper.SpecialtyMapper;
import org.springframework.samples.petclinic.model.Specialty;
import org.springframework.samples.petclinic.repository.SpecialtyRepository;
import org.springframework.samples.petclinic.rest.dto.SpecialtyDto;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.VET_ADMIN)")
public class SpecialtyRestController {
    private final SpecialtyRepository specialtyRepository;
    private final SpecialtyMapper specialtyMapper;

    @GetMapping("/specialties")
    public List<SpecialtyDto> listSpecialties() {
        List<Specialty> allSpecialties = specialtyRepository.findAll();
        return specialtyMapper.toSpecialtyDtos(allSpecialties);
    }

    @GetMapping("/specialties/{specialtyId}")
    public SpecialtyDto getSpecialty(@PathVariable int specialtyId) {
        Specialty specialty = specialtyRepository.findById(specialtyId).orElseThrow();
        return specialtyMapper.toSpecialtyDto(specialty);
    }

    @PostMapping("/specialties")
    public ResponseEntity<Void> addSpecialty(@RequestBody @Validated SpecialtyDto specialtyDto) {
        Specialty specialty = specialtyMapper.toSpecialty(specialtyDto);
        specialtyRepository.save(specialty);
        return ResponseEntity.created(UriComponentsBuilder.fromPath("/api/specialties/{id}")
                        .buildAndExpand(specialty.getId()).toUri())
                .build();
    }

    @PutMapping("/specialties/{specialtyId}")
    public void updateSpecialty(@PathVariable int specialtyId, @RequestBody @Validated SpecialtyDto specialtyDto) {
        Specialty currentSpecialty = specialtyRepository.findById(specialtyId).orElseThrow();
        currentSpecialty.setName(specialtyDto.getName());
        specialtyRepository.save(currentSpecialty);
    }

    @Transactional
    @DeleteMapping("/specialties/{specialtyId}")
    public void deleteSpecialty(@PathVariable int specialtyId) {
        Specialty specialty = specialtyRepository.findById(specialtyId).orElseThrow();
        specialtyRepository.delete(specialty);
    }
}
