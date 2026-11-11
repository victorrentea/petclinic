package victor.training.petclinic.rest;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import victor.training.petclinic.rest.dto.VisitPageDto;
import victor.training.petclinic.rest.dto.VisitRowDto;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/visits")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private static final Logger log = LoggerFactory.getLogger(VisitRestController.class);

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
            @Parameter(description = "0-based, default 0; past the end: the last page",
                    schema = @Schema(type = "integer")) @RequestParam(required = false) String page,
            @Parameter(description = "5, 10 (default) or 20; others snap to the nearest",
                    schema = @Schema(type = "integer")) @RequestParam(required = false) String size,
            @Parameter(description = "date|description|pet|owner,asc|desc; else date,desc",
                    schema = @Schema(type = "string")) @RequestParam(required = false) String sort) {
        VisitGridParams params = VisitGridParams.parse(page, size, sort);
        Page<VisitRowDto> served = findGridPageWithinBounds(params.pageable());
        log.info("Visits page {} served: {}", served.getNumber(), ownerNamesOn(served));
        return VisitPageDto.of(served, params.sort());
    }

    private Page<VisitRowDto> findGridPageWithinBounds(Pageable pageable) {
        Page<VisitRowDto> page = visitRepository.findGridPage(pageable);
        int lastPage = Math.max(page.getTotalPages() - 1, 0);
        if (page.getNumber() > lastPage) {
            return visitRepository.findGridPage(pageable.withPage(lastPage));
        }
        return page;
    }

    private static List<String> ownerNamesOn(Page<VisitRowDto> page) {
        return page.map(row -> row.ownerFirstName() + " " + row.ownerLastName()).getContent();
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
