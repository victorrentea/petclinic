package victor.training.petclinic.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import victor.training.petclinic.model.Owner;

public interface OwnerRepository extends Repository<Owner, Integer> {
    @Query(value = """
        select o.id
        from Owner o
        where o.id in (
            select distinct owner.id
            from Owner owner
            left join owner.pets pet
            where :query = ''
               or lower(concat(concat(owner.firstName, ' '), owner.lastName)) like lower(concat('%', :query, '%'))
               or lower(owner.address) like lower(concat('%', :query, '%'))
               or lower(owner.city) like lower(concat('%', :query, '%'))
               or lower(owner.telephone) like lower(concat('%', :query, '%'))
               or lower(pet.name) like lower(concat('%', :query, '%'))
        )
        """,
        countQuery = """
        select count(o.id)
        from Owner o
        where o.id in (
            select distinct owner.id
            from Owner owner
            left join owner.pets pet
            where :query = ''
               or lower(concat(concat(owner.firstName, ' '), owner.lastName)) like lower(concat('%', :query, '%'))
               or lower(owner.address) like lower(concat('%', :query, '%'))
               or lower(owner.city) like lower(concat('%', :query, '%'))
               or lower(owner.telephone) like lower(concat('%', :query, '%'))
               or lower(pet.name) like lower(concat('%', :query, '%'))
        )
        """)
    Page<Integer> searchOwnerIdsByVisibleContent(@Param("query") String query, Pageable pageable);

    @EntityGraph(attributePaths = {"pets", "pets.type"})
    @Query("""
        select distinct o
        from Owner o
        where o.id in :ownerIds
        """)
    List<Owner> findByIdInWithPets(@Param("ownerIds") List<Integer> ownerIds);

    Optional<Owner> findById(int id);

    Owner save(Owner owner);

    void delete(Owner owner);

}
