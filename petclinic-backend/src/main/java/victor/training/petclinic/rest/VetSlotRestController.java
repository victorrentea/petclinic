package victor.training.petclinic.rest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import victor.training.petclinic.mapper.TimeSlotMapper;
import victor.training.petclinic.repository.TimeSlotRepository;
import victor.training.petclinic.rest.dto.TimeSlotDto;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/vets/{vetId}/slots")
@PreAuthorize("hasAnyRole(@roles.OWNER_ADMIN, @roles.VET_ADMIN)")
public class VetSlotRestController {

    private final TimeSlotRepository timeSlotRepository;
    private final TimeSlotMapper timeSlotMapper;

    public VetSlotRestController(TimeSlotRepository timeSlotRepository, TimeSlotMapper timeSlotMapper) {
        this.timeSlotRepository = timeSlotRepository;
        this.timeSlotMapper = timeSlotMapper;
    }

    @GetMapping
    @Operation(operationId = "listFreeSlots", summary = "List the slots a vet still has free on a given day")
    @ApiResponse(responseCode = "200", description = "OK",
            content = @Content(mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = TimeSlotDto.class))))
    public List<TimeSlotDto> listFreeSlots(@PathVariable int vetId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return timeSlotMapper.toTimeSlotDtos(timeSlotRepository.findFreeSlots(vetId, date));
    }
}
