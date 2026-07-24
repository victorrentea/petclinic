package victor.training.petclinic.rewrite;

import org.junit.jupiter.api.Test;
import org.openrewrite.test.RecipeSpec;
import org.openrewrite.test.RewriteTest;

import static org.openrewrite.java.Assertions.java;

/**
 * Corner cases mirror the real methods in {@code PetTypeRestController}:
 * <ul>
 *   <li>{@code getPetType}/{@code listPetTypes}  -> single use, inline (the manual refactoring)</li>
 *   <li>{@code deletePetType}                    -> single use in a following call statement, inline</li>
 *   <li>{@code addPetType} (save + getId)        -> two uses, MUST NOT inline</li>
 *   <li>{@code updatePetType} (setName + save)   -> two uses, MUST NOT inline</li>
 * </ul>
 * plus the tricky ones a naive recipe would get wrong.
 */
class InlineSingleUseLocalVariableTest implements RewriteTest {

    @Override
    public void defaults(RecipeSpec spec) {
        spec.recipe(new InlineSingleUseLocalVariable());
    }

    // ---------- cases that SHOULD inline ----------

    @Test
    void inlinesSingleUseIntoReturn() { // == getPetType / listPetTypes
        rewriteRun(java(
            """
            class A {
                String find(int id) { return "" + id; }
                String toDto(String s) { return s; }
                String get(int id) {
                    String found = find(id);
                    return toDto(found);
                }
            }
            """,
            """
            class A {
                String find(int id) { return "" + id; }
                String toDto(String s) { return s; }
                String get(int id) {
                    return toDto(find(id));
                }
            }
            """
        ));
    }

    @Test
    void inlinesNewClassInitializer() { // == listPetTypes: new ArrayList<>(...)
        rewriteRun(java(
            """
            import java.util.ArrayList;
            import java.util.List;
            class A {
                List<String> all() { return new ArrayList<>(); }
                List<String> toDtos(List<String> in) { return in; }
                List<String> list() {
                    List<String> items = new ArrayList<>(all());
                    return toDtos(items);
                }
            }
            """,
            """
            import java.util.ArrayList;
            import java.util.List;
            class A {
                List<String> all() { return new ArrayList<>(); }
                List<String> toDtos(List<String> in) { return in; }
                List<String> list() {
                    return toDtos(new ArrayList<>(all()));
                }
            }
            """
        ));
    }

    @Test
    void inlinesIntoFollowingCallStatement() { // == deletePetType (use is a plain call, more stmts follow)
        rewriteRun(java(
            """
            class A {
                String find(int id) { return "" + id; }
                void delete(String s) {}
                void remove(int id) {
                    String found = find(id);
                    delete(found);
                }
            }
            """,
            """
            class A {
                String find(int id) { return "" + id; }
                void delete(String s) {}
                void remove(int id) {
                    delete(find(id));
                }
            }
            """
        ));
    }

    @Test
    void inlinesTwoIndependentVariablesAcrossCycles() {
        rewriteRun(
            spec -> spec.cycles(2).expectedCyclesThatMakeChanges(2),
            java(
                """
                class A {
                    String find(int id) { return "" + id; }
                    String toDto(String s) { return s; }
                    void save(String s) {}
                    void two(int id) {
                        String a = find(id);
                        save(toDto(a));
                        String b = find(id);
                        save(toDto(b));
                    }
                }
                """,
                """
                class A {
                    String find(int id) { return "" + id; }
                    String toDto(String s) { return s; }
                    void save(String s) {}
                    void two(int id) {
                        save(toDto(find(id)));
                        save(toDto(find(id)));
                    }
                }
                """
            )
        );
    }

    // ---------- cases that MUST NOT inline (the whole point) ----------

    @Test
    void keepsVariableUsedTwice() { // == addPetType: save(type) + type.getId()
        rewriteRun(java(
            """
            class A {
                String make() { return "x"; }
                void save(String s) {}
                void link(String s) {}
                void add() {
                    String type = make();
                    save(type);
                    link(type);
                }
            }
            """
        ));
    }

    @Test
    void keepsVariableUsedAsReceiverThenArgument() { // == updatePetType: setName + save
        rewriteRun(java(
            """
            class A {
                A find(int id) { return this; }
                void setName(String n) {}
                void save(A a) {}
                void update(int id, String name) {
                    A current = find(id);
                    current.setName(name);
                    save(current);
                }
            }
            """
        ));
    }

    @Test
    void keepsUnusedVariable() { // 0 uses -> dead code, not our concern
        rewriteRun(java(
            """
            class A {
                String make() { return "x"; }
                void doThing() {
                    String unused = make();
                    System.out.println("hi");
                }
            }
            """
        ));
    }

    @Test
    void keepsVariableWhoseOnlyMentionIsAReassignment() { // single mention, but it is a write
        rewriteRun(java(
            """
            class A {
                String make() { return "x"; }
                String other() { return "y"; }
                void doThing() {
                    String s = make();
                    s = other();
                }
            }
            """
        ));
    }

    @Test
    void keepsWhenUseIsNotTheAdjacentStatement() { // reordering across an intervening statement is unsafe
        rewriteRun(java(
            """
            class A {
                String find(int id) { return "" + id; }
                void log(String m) {}
                String toDto(String s) { return s; }
                String get(int id) {
                    String found = find(id);
                    log("getting");
                    return toDto(found);
                }
            }
            """
        ));
    }

    @Test
    void keepsWhenSingleUseIsInsideALoop() { // would evaluate the initializer many times
        rewriteRun(java(
            """
            class A {
                String compute() { return "p"; }
                void use(String s) {}
                void go() {
                    String prefix = compute();
                    for (int i = 0; i < 3; i++) {
                        use(prefix);
                    }
                }
            }
            """
        ));
    }

    @Test
    void keepsWhenSingleUseIsInsideALambda() { // would defer / repeat evaluation
        rewriteRun(java(
            """
            class A {
                String compute() { return "p"; }
                void use(String s) {}
                Runnable make() {
                    String p = compute();
                    return () -> use(p);
                }
            }
            """
        ));
    }

    @Test
    void keepsPrecedenceUnsafeBinaryInitializer() { // x + 1 inlined into r * 2 would misparse
        rewriteRun(java(
            """
            class A {
                int compute(int x) {
                    int sum = x + 1;
                    return sum * 2;
                }
            }
            """
        ));
    }

    @Test
    void keepsTernaryInitializer() {
        rewriteRun(java(
            """
            class A {
                int pick(boolean b, int x, int y) {
                    int r = b ? x : y;
                    return r + 1;
                }
            }
            """
        ));
    }
}
