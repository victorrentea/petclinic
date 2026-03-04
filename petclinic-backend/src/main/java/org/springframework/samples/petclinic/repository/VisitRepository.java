package org.springframework.samples.petclinic.repository;

import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.Visit;

import java.util.List;
import java.util.Optional;

public interface VisitRepository extends Repository<Visit, Integer> {

    Optional<Visit> findById(int id);

    Visit save(Visit visit);

    List<Visit> findAll();

    void delete(Visit visit);

    List<Visit> findByPetId(int petId);

}
