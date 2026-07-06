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
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.util.List;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private static final long MAX_YEARS_IN_FUTURE = 1;

    private final PetRepository petRepository;
    private final VisitRepository visitRepository;
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

    @PostMapping
    public ResponseEntity<Void> addVisit(@RequestBody @Validated VisitDto visitDto) {
        if (visitDto.getDate() != null) {
            Pet pet = petRepository.findById(visitDto.getPetId()).orElseThrow();
            validateVisitDate(visitDto.getDate(), pet.getBirthDate());
        }
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
        if (visitDto.getDate() != null) {
            validateVisitDate(visitDto.getDate(), currentVisit.getPet().getBirthDate());
        }
        currentVisit.setDate(visitDto.getDate());
        currentVisit.setDescription(visitDto.getDescription());
        visitRepository.save(currentVisit);
    }

    @Transactional
    @DeleteMapping("{visitId}")
    public void deleteVisit(@PathVariable int visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visitRepository.delete(visit);
    }

    private void validateVisitDate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate.isBefore(petBirthDate)) {
            throw new ResponseStatusException(BAD_REQUEST, "Visit date must not be before the pet birth date");
        }
        if (visitDate.isAfter(LocalDate.now().plusYears(MAX_YEARS_IN_FUTURE))) {
            throw new ResponseStatusException(BAD_REQUEST, "Visit date must not be more than 1 year in the future");
        }
    }
}
