package victor.training.petclinic.repository;

import org.springframework.data.repository.Repository;
import victor.training.petclinic.model.User;

public interface UserRepository extends Repository<User, Integer>  {
    User save(User user);
}
