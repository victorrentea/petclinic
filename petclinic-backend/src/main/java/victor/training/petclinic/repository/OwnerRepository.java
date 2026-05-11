package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.Nullable;
import victor.training.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {

    @Query(value = """
            SELECT o FROM Owner o
            WHERE (:q IS NULL OR :q = ''
               OR o.firstName  ilike concat('%', :q, '%')
               OR o.lastName   ilike concat('%', :q, '%')
               OR o.address    ilike concat('%', :q, '%')
               OR o.city       ilike concat('%', :q, '%')
               OR o.telephone  ilike concat('%', :q, '%')
               OR EXISTS (SELECT p FROM Pet p WHERE p.owner = o AND p.name ilike concat('%', :q, '%')))
            """,
            countQuery = """
            SELECT count(o) FROM Owner o
            WHERE (:q IS NULL OR :q = ''
               OR o.firstName  ilike concat('%', :q, '%')
               OR o.lastName   ilike concat('%', :q, '%')
               OR o.address    ilike concat('%', :q, '%')
               OR o.city       ilike concat('%', :q, '%')
               OR o.telephone  ilike concat('%', :q, '%')
               OR EXISTS (SELECT p FROM Pet p WHERE p.owner = o AND p.name ilike concat('%', :q, '%')))
            """)
    Page<Owner> search(@Param("q") @Nullable String q, Pageable pageable);

    List<Owner> findByLastNameStartingWith(String lastName);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    List<Owner> findAll();

    void delete(Owner owner);

}
