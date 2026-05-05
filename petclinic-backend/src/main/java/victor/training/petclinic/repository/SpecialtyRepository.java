package victor.training.petclinic.repository;

import org.springframework.data.repository.Repository;
import victor.training.petclinic.model.Specialty;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface SpecialtyRepository extends Repository<Specialty, Integer> {

    Optional<Specialty> findById(int id);

    List<Specialty> findSpecialtiesByNameIn(Set<String> names);

    List<Specialty> findAll();

    Specialty save(Specialty specialty);

    void delete(Specialty specialty);

}
