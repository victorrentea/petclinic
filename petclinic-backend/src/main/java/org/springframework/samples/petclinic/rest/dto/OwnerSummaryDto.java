package org.springframework.samples.petclinic.rest.dto;

import java.util.List;

public record OwnerSummaryDto(
    Integer id,
    String displayName,
    String address,
    String city,
    String telephone,
    List<PetSummaryDto> pets
) {}
