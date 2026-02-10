package org.springframework.samples.petclinic.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Vet;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VetRepository extends Repository<Vet, Integer> {
    @Query("SELECT DISTINCT v FROM Vet v LEFT JOIN FETCH v.specialties")
    List<Vet> findAll();

    @Query("SELECT v FROM Vet v LEFT JOIN FETCH v.specialties WHERE v.id = :id")
    Optional<Vet> findById(@Param("id") int id);

    void save(Vet vet);

    void delete(Vet vet);

}
