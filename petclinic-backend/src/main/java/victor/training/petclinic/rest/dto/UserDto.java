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

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public List<RoleDto> getRoles() {
        return roles;
    }

    public void setRoles(List<RoleDto> roles) {
        this.roles = roles;
    }
}
