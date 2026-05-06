package org.springframework.samples.petclinic.rest;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.JpaSort;

public enum OwnerSortField {
    NAME {
        @Override
        public Sort toSort(Sort.Direction direction) {
            return JpaSort.unsafe(direction, "CONCAT(o.firstName, ' ', o.lastName)");
        }
    },
    CITY {
        @Override
        public Sort toSort(Sort.Direction direction) {
            return Sort.by(direction, "city");
        }
    };

    public abstract Sort toSort(Sort.Direction direction);
}
