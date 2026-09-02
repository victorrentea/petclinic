package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import victor.training.petclinic.domain.User;
import victor.training.petclinic.rest.dto.UserDto;

@Mapper(componentModel = "spring")
public interface UserMapper {

    User toUser(UserDto userDto);

    UserDto toUserDto(User user);

}
