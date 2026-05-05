package victor.training.petclinic.rest;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.SpecialtyMapper;
import victor.training.petclinic.mapper.VetMapper;
import victor.training.petclinic.model.Specialty;
import victor.training.petclinic.model.Vet;
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
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.VET_ADMIN)")
public class VetRestController {

    private final VetMapper vetMapper;
    private final SpecialtyMapper specialtyMapper;
    private final VetRepository vetRepository;
    private final SpecialtyRepository specialtyRepository;

    @GetMapping
    public List<VetDto> listVets() {
        List<Vet> allVets = vetRepository.findAll();
        return vetMapper.toVetDtos(allVets);
    }

    @GetMapping("{vetId}")
    public VetDto getVet(@PathVariable int vetId)  {
        Vet vet = vetRepository.findById(vetId).orElseThrow();
        return vetMapper.toVetDto(vet);
    }

    @PostMapping
    public ResponseEntity<Void> addVet(@RequestBody @Validated VetDto vetDto) {
        Vet vet = vetMapper.toVet(vetDto);
        updateSpecialties(vet);
        URI createdVetUri = UriComponentsBuilder.fromPath("/api/vets/{id}")
            .buildAndExpand(vet.getId()).toUri();
        return ResponseEntity.created(createdVetUri).build();
    }


    @PutMapping("{vetId}")
    public void updateVet(@PathVariable int vetId, @RequestBody VetDto vetDto)  {
        Vet currentVet = vetRepository.findById(vetId).orElseThrow();
        currentVet.setFirstName(vetDto.getFirstName());
        currentVet.setLastName(vetDto.getLastName());
        currentVet.clearSpecialties();
        for (Specialty spec : specialtyMapper.toSpecialty(vetDto.getSpecialties())) {
            currentVet.addSpecialty(spec);
        }
        updateSpecialties(currentVet);
    }

    private void updateSpecialties(Vet currentVet) {
        if(currentVet.getNrOfSpecialties() > 0){
            Set<String> names = currentVet.getSpecialties().stream().map(Specialty::getName).collect(Collectors.toSet());
            List<Specialty> vetSpecialities = specialtyRepository.findSpecialtiesByNameIn(names);
            currentVet.setSpecialties(vetSpecialities);
        }
        vetRepository.save(currentVet);
    }

    @Transactional
    @DeleteMapping("{vetId}")
    public void deleteVet(@PathVariable int vetId) {
        Vet vet = vetRepository.findById(vetId).orElseThrow();
        vetRepository.delete(vet);
    }
}
