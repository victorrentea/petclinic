package victor.training.petclinic.rewrite;

import org.junit.jupiter.api.Test;
import org.openrewrite.test.RecipeSpec;
import org.openrewrite.test.RewriteTest;

import static org.openrewrite.java.Assertions.java;

/**
 * Tests the recipe that the {@code rewrite-templating} processor generates from {@link ListGetFirst}.
 * The generated class is {@code ListGetFirstRecipe} (single template -> "...Recipe").
 */
class ListGetFirstTest implements RewriteTest {

    @Override
    public void defaults(RecipeSpec spec) {
        spec.recipe(new ListGetFirstRecipe());
    }

    @Test
    void rewritesGetZeroToGetFirst() {
        rewriteRun(java(
            """
            import java.util.List;
            class A {
                String first(List<String> items) {
                    return items.get(0);
                }
            }
            """,
            """
            import java.util.List;
            class A {
                String first(List<String> items) {
                    return items.getFirst();
                }
            }
            """
        ));
    }

    @Test
    void rewritesGetZeroOnAChainedReceiver() {
        rewriteRun(java(
            """
            import java.util.List;
            class Owner { List<String> getPets() { return List.of(); } }
            class A {
                String firstPet(Owner owner) {
                    return owner.getPets().get(0);
                }
            }
            """,
            """
            import java.util.List;
            class Owner { List<String> getPets() { return List.of(); } }
            class A {
                String firstPet(Owner owner) {
                    return owner.getPets().getFirst();
                }
            }
            """
        ));
    }

    @Test
    void leavesOtherIndexesAlone() {
        rewriteRun(java(
            """
            import java.util.List;
            class A {
                String second(List<String> items) {
                    return items.get(1);
                }
            }
            """
        ));
    }

    @Test
    void leavesNonListGetAlone() {
        rewriteRun(java(
            """
            import java.util.Map;
            class A {
                String lookup(Map<Integer, String> m) {
                    return m.get(0);
                }
            }
            """
        ));
    }
}
