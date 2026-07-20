package victor.training.petclinic.rest;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import victor.training.petclinic.rest.error.InvalidVisitDateException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private final VisitRepository visitRepository;
    private final VisitMapper visitMapper;
    private final PetRepository petRepository;

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
        LocalDate petBirthDate = petRepository.findById(visitDto.getPetId())
                .map(Pet::getBirthDate)
                .orElse(null);
        validateVisitDate(visitDto.getDate(), petBirthDate);
        Visit visit = visitMapper.toVisit(visitDto);
        visitRepository.save(visit);
        return visit.getId();
    }

    @PutMapping("{visitId}")
    public void updateVisit(@PathVariable int visitId, @RequestBody @Validated VisitFieldsDto visitDto) {
        Visit currentVisit = visitRepository.findById(visitId).orElseThrow();
        LocalDate petBirthDate = currentVisit.getPet() == null ? null : currentVisit.getPet().getBirthDate();
        validateVisitDate(visitDto.getDate(), petBirthDate);
        currentVisit.setDate(visitDto.getDate());
        currentVisit.setDescription(visitDto.getDescription());
        visitRepository.save(currentVisit);
    }

    /**
     * Enforces the visit-date window (Issue #40): a visit may not predate the pet's birth date,
     * nor be booked more than one year into the future. A null date is left to the field-level
     * validation on the DTO.
     */
    private void validateVisitDate(LocalDate date, LocalDate petBirthDate) {
        if (date == null) {
            return;
        }
        LocalDate latestAllowed = LocalDate.now().plusYears(1);
        if (date.isAfter(latestAllowed)) {
            throw new InvalidVisitDateException(
                    "Visit date must not be more than one year in the future (after " + latestAllowed + ")");
        }
        if (petBirthDate != null && date.isBefore(petBirthDate)) {
            throw new InvalidVisitDateException(
                    "Visit date must not be before the pet's birth date (" + petBirthDate + ")");
        }
    }

    @Transactional
    @DeleteMapping("{visitId}")
    public void deleteVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visitRepository.delete(visit);
    }
}
