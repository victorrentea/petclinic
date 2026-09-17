package victor.training.petclinic.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import victor.training.petclinic.domain.Owner;

/**
 * Fragment interface for {@link OwnerRepository} methods that need hand-written HQL rather than
 * Spring Data's derived query machinery — see {@link OwnerRepositoryImpl} for why.
 */
public interface OwnerRepositoryCustom {

    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);
}
