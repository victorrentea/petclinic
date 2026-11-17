package victor.training.petclinic.repository;

import java.util.List;

/** Scalar queries that page and count owner roots only; no collections are loaded here. */
public interface OwnerRepositoryCustom {

    /** IDs of one page of the owners whose last name starts with the literal prefix, in sort order. */
    List<Integer> findIdsPage(String lastNamePrefix, OwnerSort sort, int size, long offset);

    long countByLastNamePrefix(String lastNamePrefix);
}
