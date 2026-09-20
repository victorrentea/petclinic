package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

import java.util.ArrayList;
import java.util.List;

public class UserDto {

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "john.doe", description = "The username")
    private String username;

    @Size(min = 1, max = 80)
    @Schema(example = "1234abc", description = "The password")
    private @Nullable String password;

    @Schema(example = "true", description = "Indicates if the user is enabled")
    private @Nullable Boolean enabled;

    @Valid
    @Schema(description = "The roles of an user")
    private List<@Valid RoleDto> roles = new ArrayList<>();

    public String getUsername() {
        return username;
    }

    public UserDto setUsername(String username) {
        this.username = username;
        return this;
    }

    public String getPassword() {
        return password;
    }

    public UserDto setPassword(String password) {
        this.password = password;
        return this;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public UserDto setEnabled(Boolean enabled) {
        this.enabled = enabled;
        return this;
    }

    public List<RoleDto> getRoles() {
        return roles;
    }

    public UserDto setRoles(List<RoleDto> roles) {
        this.roles = roles;
        return this;
    }
}
