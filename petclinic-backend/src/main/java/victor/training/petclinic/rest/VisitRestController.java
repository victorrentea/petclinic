package victor.training.petclinic.rest;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.model.Vet;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.VetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private final VisitRepository visitRepository;
    private final VisitMapper visitMapper;
    private final VetRepository vetRepository;

    @GetMapping
    public List<VisitDto> listVisits() {
        List<Visit> visits = visitRepository.findAllWithPetAndOwner();
        return visitMapper.toVisitsDto(visits);
    }

    @GetMapping("{visitId}")
    public VisitDto getVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        return visitMapper.toVisitDto(visit);
    }

    @PostMapping
    public ResponseEntity<Void> addVisit(@RequestBody @Validated VisitDto visitDto) {
        Visit visit = visitMapper.toVisit(visitDto);
        visit.setVet(requireVet(visitDto.getVetId()));
        visitRepository.save(visit);
        return ResponseEntity.created(UriComponentsBuilder.fromPath("/api/visits/{id}")
                        .buildAndExpand(visit.getId()).toUri())
                .build();
    }

    @PutMapping("{visitId}")
    public void updateVisit(@PathVariable int visitId, @RequestBody @Validated VisitFieldsDto visitDto) {
        Visit currentVisit = visitRepository.findById(visitId).orElseThrow();
        currentVisit.setDate(visitDto.getDate());
        currentVisit.setDescription(visitDto.getDescription());
        currentVisit.setVet(requireVet(visitDto.getVetId()));
        visitRepository.save(currentVisit);
    }

    @Transactional
    @DeleteMapping("{visitId}")
    public void deleteVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visitRepository.delete(visit);
    }

    private Vet requireVet(Integer vetId) {
        if (vetId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "vetId is required");
        }
        return vetRepository.findById(vetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vet not found"));
    }
}
