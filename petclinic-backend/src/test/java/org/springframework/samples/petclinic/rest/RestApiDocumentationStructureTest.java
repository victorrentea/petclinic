package org.springframework.samples.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;

import io.swagger.v3.oas.annotations.Operation;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.util.ClassUtils;

class RestApiDocumentationStructureTest {

    private static final String OWNER_API_CLASS_NAME = "org.springframework.samples.petclinic.rest.OwnerRestApi";
    private static final String USER_API_CLASS_NAME = "org.springframework.samples.petclinic.rest.UserRestApi";

    @Test
    void ownerControllerUsesApiInterfaceAndPageableSignature() throws Exception {
        assertThat(ClassUtils.isPresent(OWNER_API_CLASS_NAME, getClass().getClassLoader())).isTrue();

        Class<?> ownerApiClass = Class.forName(OWNER_API_CLASS_NAME);

        assertThat(OwnerRestController.class.getInterfaces()).contains(ownerApiClass);
        assertThat(Arrays.stream(OwnerRestController.class.getDeclaredMethods())
            .anyMatch(method -> method.getName().equals("listOwners")
                && Arrays.equals(method.getParameterTypes(), new Class<?>[]{String.class, Pageable.class})))
            .isTrue();
        assertThat(Arrays.stream(OwnerRestController.class.getDeclaredMethods())
            .filter(method -> method.getName().equals("listOwners"))
            .findFirst()
            .orElseThrow()
            .isAnnotationPresent(Operation.class))
            .isFalse();
        assertThat(ownerApiClass.getDeclaredMethod("listOwners", String.class, Pageable.class)
            .isAnnotationPresent(Operation.class))
            .isTrue();
    }

    @Test
    void userControllerUsesApiInterfaceForOpenApiAnnotations() throws Exception {
        assertThat(ClassUtils.isPresent(USER_API_CLASS_NAME, getClass().getClassLoader())).isTrue();

        Class<?> userApiClass = Class.forName(USER_API_CLASS_NAME);

        assertThat(UserRestController.class.getInterfaces()).contains(userApiClass);
        assertThat(Arrays.stream(UserRestController.class.getDeclaredMethods())
            .filter(method -> method.getName().equals("addUser"))
            .findFirst()
            .orElseThrow()
            .isAnnotationPresent(Operation.class))
            .isFalse();
        assertThat(userApiClass.getDeclaredMethod("addUser", org.springframework.samples.petclinic.rest.dto.UserDto.class)
            .isAnnotationPresent(Operation.class))
            .isTrue();
    }
}
