package victor.training.petclinic.rest;

import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import java.lang.annotation.Retention;
import java.lang.annotation.Target;
import java.util.stream.IntStream;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** A whitelist of ints, where {@code @Min}/{@code @Max} would also let through every number in between. */
@Target(PARAMETER)
@Retention(RUNTIME)
@Constraint(validatedBy = OneOf.Validator.class)
public @interface OneOf {
    int[] value();

    String message() default "must be one of {value}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<OneOf, Integer> {
        private int[] allowed;

        @Override
        public void initialize(OneOf annotation) {
            allowed = annotation.value();
        }

        @Override
        public boolean isValid(Integer value, ConstraintValidatorContext context) {
            return value == null || IntStream.of(allowed).anyMatch(a -> a == value);
        }
    }
}
