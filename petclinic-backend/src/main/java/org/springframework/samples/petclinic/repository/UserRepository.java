package org.springframework.samples.petclinic.repository;

import org.springframework.data.repository.Repository;
import org.springframework.samples.petclinic.model.User;

public interface UserRepository extends Repository<User, Integer>  {
    User save(User user);
}
