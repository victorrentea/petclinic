package victor.training.petclinic.rest;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/visits")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private final VisitRepository visitRepository;
    private final PetRepository petRepository;
    private final VisitMapper visitMapper;

    public VisitRestController(VisitRepository visitRepository, PetRepository petRepository,
            VisitMapper visitMapper) {
        this.visitRepository = visitRepository;
        this.petRepository = petRepository;
        this.visitMapper = visitMapper;
    }

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

    @PostMapping
    public ResponseEntity<Void> addVisit(@RequestBody @Validated VisitDto visitDto) {
        Pet pet = petRepository.findById(visitDto.getPetId()).orElseThrow();
        requireDateWithinVisitableRange(visitDto.getDate(), pet);
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
        visitRepository.save(visit);
        return visit.getId();
    }

    @PutMapping("{visitId}")
    public void updateVisit(@PathVariable int visitId, @RequestBody @Validated VisitFieldsDto visitDto) {
        Visit currentVisit = visitRepository.findById(visitId).orElseThrow();
        requireDateWithinVisitableRange(visitDto.getDate(), currentVisit.getPet());
        currentVisit.setDate(visitDto.getDate());
        currentVisit.setDescription(visitDto.getDescription());
        visitRepository.save(currentVisit);
    }

    // Issue #40: a visit cannot predate the pet, nor be booked more than a year ahead.
    // The form guards the same range; this is the half that also holds for an API client.
    private void requireDateWithinVisitableRange(LocalDate date, Pet pet) {
        if (date == null) {
            return;
        }
        LocalDate earliest = pet == null ? null : pet.getBirthDate();
        if (earliest != null && date.isBefore(earliest)) {
            throw new IllegalArgumentException(
                    "Visit date " + date + " is before the pet's birth date " + earliest);
        }
        LocalDate latest = LocalDate.now().plusYears(1);
        if (date.isAfter(latest)) {
            throw new IllegalArgumentException(
                    "Visit date " + date + " is more than one year in the future (after " + latest + ")");
        }
    }

    @Transactional
    @DeleteMapping("{visitId}")
    public void deleteVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visitRepository.delete(visit);
    }
}
