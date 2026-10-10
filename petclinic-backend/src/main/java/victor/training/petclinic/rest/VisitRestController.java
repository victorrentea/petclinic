package victor.training.petclinic.rest;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import victor.training.petclinic.rest.dto.VisitPageDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@Validated
@RequestMapping("/api/visits")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private static final Logger log = LoggerFactory.getLogger(VisitRestController.class);

    static final int MAX_PAGE_SIZE = 100;

    private final VisitRepository visitRepository;
    private final VisitMapper visitMapper;

    public VisitRestController(VisitRepository visitRepository, VisitMapper visitMapper) {
        this.visitRepository = visitRepository;
        this.visitMapper = visitMapper;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = VisitPageDto.class),
                    examples = @ExampleObject(name = "sample", value = ApiExamples.VISITS)))
    public VisitPageDto listVisits(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(MAX_PAGE_SIZE) int size,
            @RequestParam(defaultValue = "date,desc") @Pattern(regexp = "(date|description|pet|owner)(,(asc|desc))?",
                    message = "must be date, description, pet or owner, optionally followed by ,asc or ,desc") String sort) {
        Page<Visit> visits = visitRepository.findAllWithPetAndOwner(PageRequest.of(page, size, toSort(sort)));
        return new VisitPageDto(visitMapper.toVisitsDto(visits.getContent()),
                visits.getTotalElements(), visits.getTotalPages(), visits.getNumber(), visits.getSize());
    }

    // The direction applies to the clicked column only; ties go latest first, then by id,
    // so rows tied on every sorted field never show up on two pages, or on none.
    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",");
        Direction direction = keyAndDirection.length > 1 ? Direction.fromString(keyAndDirection[1]) : Direction.ASC;
        Sort latestFirst = Sort.by(Direction.DESC, "date").and(Sort.by("id"));
        return switch (keyAndDirection[0]) {
            case "date" -> Sort.by(direction, "date").and(Sort.by("id"));
            case "description" -> Sort.by(direction, "description").and(latestFirst);
            case "pet" -> Sort.by(direction, "pet.name").and(latestFirst);
            default -> Sort.by(direction, "pet.owner.firstName", "pet.owner.lastName").and(latestFirst);
        };
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
        log.info("Booking visit for pet {}: {}", visitDto.getPetId(), visitDto.getDescription());
        Visit visit = visitMapper.toVisit(visitDto);
        visitRepository.save(visit);
        return visit.getId();
    }

    @PutMapping("{visitId}")
    public void updateVisit(@PathVariable int visitId, @RequestBody @Validated VisitFieldsDto visitDto) {
        Visit currentVisit = visitRepository.findById(visitId).orElseThrow();
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
}
