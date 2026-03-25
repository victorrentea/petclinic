package org.springframework.samples.petclinic.rest.dto;

import java.util.List;

public record PagedOwnersDto(
    List<OwnerDto> owners,
    long totalElements,
    int totalPages,
    int currentPage
) {}
