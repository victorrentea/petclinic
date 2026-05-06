package org.springframework.samples.petclinic.rest.dto;

import lombok.Data;

import java.util.List;

@Data
public class OwnerPageDto {
    private List<OwnerDto> content;
    private long totalElements;
    private int totalPages;
    private int number;
    private int size;
}
