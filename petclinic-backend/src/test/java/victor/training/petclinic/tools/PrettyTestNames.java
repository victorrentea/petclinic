package victor.training.petclinic.tools;

import java.lang.reflect.Method;
import java.util.List;

import org.junit.jupiter.api.DisplayNameGenerator;

/**
 * Turns camelCase class and method names into plain sentences, so a @Nested test class reads as a
 * specification rather than as code. Use via @DisplayNameGeneration on the test class.
 */
public class PrettyTestNames extends DisplayNameGenerator.ReplaceUnderscores {

    @Override
    public String generateDisplayNameForClass(Class<?> testClass) {
        return replaceCapitals(super.generateDisplayNameForClass(testClass));
    }

    @Override
    public String generateDisplayNameForNestedClass(List<Class<?>> enclosingInstanceTypes, Class<?> nestedClass) {
        return replaceCapitals(super.generateDisplayNameForNestedClass(enclosingInstanceTypes, nestedClass));
    }

    @Override
    public String generateDisplayNameForMethod(List<Class<?>> enclosingInstanceTypes, Class<?> testClass,
            Method testMethod) {
        return replaceCapitals(super.generateDisplayNameForMethod(enclosingInstanceTypes, testClass, testMethod));
    }

    private String replaceCapitals(String name) {
        return name.replaceAll("([A-Z])", " $1")
                .replaceAll("_", " > ")
                .replaceAll("\\s+", " ")
                .toLowerCase();
    }
}
