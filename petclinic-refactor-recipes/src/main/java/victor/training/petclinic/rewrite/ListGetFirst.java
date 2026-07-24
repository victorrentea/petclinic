package victor.training.petclinic.rewrite;

import com.google.errorprone.refaster.annotation.AfterTemplate;
import com.google.errorprone.refaster.annotation.BeforeTemplate;
import org.openrewrite.java.template.RecipeDescriptor;

import java.util.List;

/**
 * A <strong>Refaster template</strong> recipe: the whole recipe is just a before/after pair of code
 * snippets. The {@code rewrite-templating} annotation processor reads this class at build time and
 * generates the actual recipe class {@code ListGetFirstRecipe} (class name + {@code Recipe} because
 * there is a single template).
 *
 * <p>It replaces {@code list.get(0)} with the Java 21 {@code list.getFirst()} (from
 * {@link java.util.SequencedCollection}). Because Refaster works on a typed template, it only matches
 * when the receiver is really a {@link List} — {@code someArray[0]} or a {@code get(0)} on an
 * unrelated type is left alone. Compare with {@code InlineSingleUseLocalVariable}: that one cannot be
 * a Refaster template because it must count references and delete a statement — analysis a fixed
 * before/after snippet cannot express.</p>
 */
@RecipeDescriptor(
    name = "Use `List#getFirst()` instead of `list.get(0)`",
    description = "Replaces `list.get(0)` with `list.getFirst()` (Java 21 SequencedCollection), which reads " +
                  "more clearly. Note: on an empty list `get(0)` throws IndexOutOfBoundsException while " +
                  "`getFirst()` throws NoSuchElementException — both signal \"no first element\"."
)
public class ListGetFirst<T> {

    @BeforeTemplate
    T getZero(List<T> list) {
        return list.get(0);
    }

    @AfterTemplate
    T getFirst(List<T> list) {
        return list.getFirst();
    }
}
