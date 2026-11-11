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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/visits")
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class VisitRestController {
    private static final Logger log = LoggerFactory.getLogger(VisitRestController.class);
    private static final List<Integer> PAGE_SIZES = List.of(5, 10, 20);

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
                    examples = @ExampleObject(name = "sample", value = ApiExamples.VISITS_PAGE)))
    public VisitPageDto listVisits(
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "5, 10 or 20") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "date, description, pet or owner") @RequestParam(
                    defaultValue = "date") String sort,
            @Parameter(description = "asc or desc") @RequestParam(defaultValue = "desc") String direction) {
        if (page < 0 || !PAGE_SIZES.contains(size)) {
            throw new ResponseStatusException(BAD_REQUEST, "page must be >= 0, and size one of " + PAGE_SIZES);
        }
        Sort sortThenId = sortOf(sort, direction).and(Sort.by("id"));
        Page<VisitRowDto> rows = visitRepository.findRows(PageRequest.of(page, size, sortThenId));
        log.info("Visits page {} served: {}", page, ownerNames(rows));
        return new VisitPageDto(rows);
    }

    private static Sort sortOf(String column, String direction) {
        if (!direction.equals("asc") && !direction.equals("desc")) {
            throw new ResponseStatusException(BAD_REQUEST, "Unsupported direction");
        }
        boolean asc = direction.equals("asc");
        if (column.equals("date")) {
            if (asc)
                return Sort.by(ASC, "date");
            return Sort.by(DESC, "date");
        } else if (column.equals("description")) {
            if (asc)
                return Sort.by(ASC, "description");
            return Sort.by(DESC, "description");
        } else if (column.equals("pet")) {
            if (asc)
                return Sort.by(ASC, "pet.name");
            return Sort.by(DESC, "pet.name");
        } else if (column.equals("owner")) {
            if (asc)
                return Sort.by(ASC, "pet.owner.firstName", "pet.owner.lastName");
            return Sort.by(DESC, "pet.owner.firstName", "pet.owner.lastName");
        }
        throw new ResponseStatusException(BAD_REQUEST, "Unsupported sort");
    }

    private static List<String> ownerNames(Page<VisitRowDto> rows) {
        return rows.getContent().stream()
                .map(row -> row.ownerFirstName() + " " + row.ownerLastName())
                .toList();
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
