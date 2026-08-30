package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.TimeSlot;
import victor.training.petclinic.rest.dto.TimeSlotDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class TimeSlotMapper {

    public TimeSlotDto toTimeSlotDto(TimeSlot timeSlot) {
        TimeSlotDto dto = new TimeSlotDto();
        dto.setId(timeSlot.getId());
        dto.setVetId(timeSlot.getVet().getId());
        dto.setDate(timeSlot.getDate());
        dto.setStartTime(timeSlot.getStartTime());
        dto.setEndTime(timeSlot.getEndTime());
        return dto;
    }

    public List<TimeSlotDto> toTimeSlotDtos(List<TimeSlot> timeSlots) {
        List<TimeSlotDto> dtos = new ArrayList<>(timeSlots.size());
        for (TimeSlot timeSlot : timeSlots) {
            dtos.add(toTimeSlotDto(timeSlot));
        }
        return dtos;
    }
}
