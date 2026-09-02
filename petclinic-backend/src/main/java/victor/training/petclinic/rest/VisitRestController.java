package victor.training.petclinic.rest;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.domain.Vet;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.VetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private final VisitRepository visitRepository;
    private final VetRepository vetRepository;
    private final VisitMapper visitMapper;

    @GetMapping
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = VisitDto.class)),
                    examples = @ExampleObject(name = "sample", value = ApiExamples.VISITS)))
    public List<VisitDto> listVisits() {
        List<Visit> visits = visitRepository.findAllWithPetAndOwner();
        return visitMapper.toVisitsDto(visits);
    }

    @GetMapping("{visitId}")
    public VisitDto getVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        return visitMapper.toVisitDto(visit);
    }

    // On the public entry point, not on bookVisit: that one is private and self-invoked,
    // so a @Transactional there would be silently ignored by Spring AOP — the same reason
    // the span below has to come from the bytecode agent.
    @Transactional
    @PostMapping
    public ResponseEntity<Void> addVisit(@RequestBody @Validated VisitDto visitDto) {
        int id = bookVisit(visitDto);
        return ResponseEntity.created(UriComponentsBuilder.fromPath("/api/visits/{id}")
                .buildAndExpand(id).toUri())
                .build();
    }

    // Explicit span so the booking step shows up in the Tempo trace (and the
    // generated sequence diagram) next to the auto-instrumented SERVER/JDBC spans.
    // The OTel Java agent instruments @WithSpan at the bytecode level, so it works
    // on a private, self-invoked method (Spring AOP would not) — keeping the
    // repository-only, no-service-layer house style.
    @WithSpan("book-visit")
    private int bookVisit(VisitDto visitDto) {
        Visit visit = visitMapper.toVisit(visitDto);
        visit.setVet(resolveVet(visitDto.getVetId()));
        visitRepository.save(visit);
        return visit.getId();
    }

    @Transactional
    @PutMapping("{visitId}")
    public void updateVisit(@PathVariable int visitId, @RequestBody @Validated VisitFieldsDto visitDto) {
        Visit currentVisit = visitRepository.findById(visitId).orElseThrow();
        currentVisit.setDate(visitDto.getDate());
        currentVisit.setDescription(visitDto.getDescription());
        currentVisit.setVet(resolveVet(visitDto.getVetId()));
        visitRepository.save(currentVisit);
    }

    private Vet resolveVet(Integer vetId) {
        try {
            return vetRepository.getByIdOrNull(vetId);
        } catch (NoSuchElementException e) {
            log.warn("Rejecting visit: attending vet id {} does not exist", vetId);
            throw e;
        }
    }

    @Transactional
    @DeleteMapping("{visitId}")
    public void deleteVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visitRepository.delete(visit);
    }
}
