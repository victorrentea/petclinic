package victor.training.petclinic.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import victor.training.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {
    @EntityGraph(attributePaths = {"pets", "pets.type"})
    @Query(value = """
        select distinct o
        from Owner o
        left join o.pets p
        where :query = ''
           or lower(concat(concat(o.firstName, ' '), o.lastName)) like lower(concat('%', :query, '%'))
           or lower(o.address) like lower(concat('%', :query, '%'))
           or lower(o.city) like lower(concat('%', :query, '%'))
           or lower(o.telephone) like lower(concat('%', :query, '%'))
           or lower(p.name) like lower(concat('%', :query, '%'))
        """,
        countQuery = """
        select count(distinct o.id)
        from Owner o
        left join o.pets p
        where :query = ''
           or lower(concat(concat(o.firstName, ' '), o.lastName)) like lower(concat('%', :query, '%'))
           or lower(o.address) like lower(concat('%', :query, '%'))
           or lower(o.city) like lower(concat('%', :query, '%'))
           or lower(o.telephone) like lower(concat('%', :query, '%'))
           or lower(p.name) like lower(concat('%', :query, '%'))
        """)
    Page<Owner> searchByVisibleContent(@Param("query") String query, Pageable pageable);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

}
