package victor.training.petclinic.guardrail;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.CallableDeclaration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The reference cases from G. Ann Campbell's white paper "Cognitive Complexity, a new way of
 * measuring understandability" (SonarSource, 2018) — the ones that separate this metric from
 * McCabe: the nesting penalty, the free {@code else}, and the flat-rate {@code switch}.
 */
class CognitiveComplexityTest {

    private static int score(String methodSource) {
        return CognitiveComplexity.of(parse(methodSource)).total();
    }

    private static List<String> lines(String methodSource) {
        return CognitiveComplexity.of(parse(methodSource)).increments().stream()
                .map(i -> i.reason() + " +" + i.cost() + (i.nesting() > 0 ? " (nesting " + i.nesting() + ")" : ""))
                .toList();
    }

    private static CallableDeclaration<?> parse(String methodSource) {
        CompilationUnit cu = StaticJavaParser.parse("class X {\n" + methodSource + "\n}");
        return cu.findFirst(CallableDeclaration.class).orElseThrow();
    }

    @Nested
    @DisplayName("a. an increment for each break in the linear flow")
    class Increments {
        @Test
        void straightLineCodeScoresZero() {
            assertThat(score("int f(int a) { int b = a + 1; return b * 2; }")).isZero();
        }

        @Test
        void eachLoopAndCatchCountsOne() {
            assertThat(score("""
                    void f(int[] xs) {
                        for (int x : xs) { }
                        while (g()) { }
                        do { } while (g());
                        try { g(); } catch (RuntimeException e) { }
                    }
                    """)).isEqualTo(4);
        }

        @Test
        void tryAndFinallyAreFree() {
            assertThat(score("void f() { try { g(); } finally { h(); } }")).isZero();
        }

        @Test
        void ternaryCountsOne() {
            assertThat(score("int f(int a) { return a > 0 ? 1 : 2; }")).isEqualTo(1);
        }

        @Test
        void recursionCountsOneOnTopOfTheTernaryItHidesIn() {
            assertThat(score("int fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }")).isEqualTo(2);
        }

        @Test
        void anOverloadIsNotRecursion() {
            // toSpecialty(List) delegating to toSpecialty(SpecialtyDto) is what every MapStruct
            // collection mapper does; without a symbol solver the only safe answer is "not a cycle",
            // so only the for-each counts
            assertThat(score("""
                    java.util.List<String> f(java.util.List<Integer> xs) {
                        java.util.List<String> out = new java.util.ArrayList<>();
                        for (Integer x : xs) { out.add(f(x)); }
                        return out;
                    }
                    String f(Integer x) { return x.toString(); }
                    """)).isEqualTo(1);
        }

        @Test
        void breakToALabelCountsOneButAPlainBreakDoesNot() {
            assertThat(score("""
                    void f(int[] xs) {
                        outer:
                        for (int x : xs) {
                            for (int y : xs) {
                                if (y == 0) break outer;
                                if (y == 1) break;
                            }
                        }
                    }
                    """))
                    // for +1, for +2, if +3, break outer +1, if +3 = 10
                    .isEqualTo(10);
        }

        @Test
        void aSequenceOfLikeOperatorsCountsOnceAndEachSwitchOfOperatorRestartsIt() {
            assertThat(score("boolean f(boolean a, boolean b, boolean c) { return a && b && c; }")).isEqualTo(1);
            assertThat(score("boolean f(boolean a, boolean b, boolean c) { return a || b || c; }")).isEqualTo(1);
            // the white paper's own example: a && b && c || d || e && f
            assertThat(score("""
                    boolean f(boolean a, boolean b, boolean c, boolean d, boolean e, boolean g) {
                        return a && b && c || d || e && g;
                    }
                    """)).isEqualTo(3);
        }

        @Test
        void negationStartsAFreshSequence() {
            assertThat(score("boolean f(boolean a, boolean b, boolean c) { return a && !(b && c); }")).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("b. an increment costs 1 + the nesting level it sits in")
    class NestingPenalty {
        @Test
        void theWhitePaperNestedExampleScoresNine() {
            assertThat(score("""
                    void myMethod(boolean c1, boolean c2) {
                        try {
                            if (c1) {
                                for (int i = 0; i < 10; i++) {
                                    while (c2) { g(); }
                                }
                            }
                        } catch (RuntimeException e) {
                            if (c2) { g(); }
                        }
                    }
                    """)).isEqualTo(9);
        }

        @Test
        void flatCodeWithTheSameBranchCountScoresFarLess() {
            assertThat(score("""
                    void flat(boolean c1, boolean c2) {
                        if (c1) { g(); }
                        for (int i = 0; i < 10; i++) { g(); }
                        while (c2) { g(); }
                    }
                    """)).isEqualTo(3);
        }

        @Test
        void aLambdaBodyNestsOneDeeperWithoutCostingAnything() {
            assertThat(score("""
                    void f(java.util.List<String> xs) {
                        xs.forEach(x -> {
                            if (x.isEmpty()) { g(); }
                        });
                    }
                    """)).isEqualTo(2);
        }

        @Test
        void tryDoesNotNestButCatchDoes() {
            assertThat(lines("""
                    void f(boolean c) {
                        try {
                            if (c) { g(); }
                        } catch (RuntimeException e) {
                            if (c) { g(); }
                        }
                    }
                    """)).containsExactly("if +1", "catch +1", "if +2 (nesting 1)");
        }
    }

    @Nested
    @DisplayName("c. no penalty for the shorthand a reader takes in at a glance")
    class NoShorthandPenalty {
        @Test
        void aSwitchCostsOneNoMatterHowManyCases() {
            assertThat(score("""
                    String f(int a) {
                        switch (a) {
                            case 1: return "a";
                            case 2: return "b";
                            case 3: return "c";
                            case 4: return "d";
                            default: return "?";
                        }
                    }
                    """)).isEqualTo(1);
        }

        @Test
        void anEquivalentIfElseIfChainCostsOnePerBranch() {
            assertThat(score("""
                    String f(int a) {
                        if (a == 1) return "a";
                        else if (a == 2) return "b";
                        else if (a == 3) return "c";
                        else return "?";
                    }
                    """)).isEqualTo(4);
        }

        @Test
        void elseCostsOneWithoutTheNestingPenalty() {
            // the white paper's if / else if / else example: 1 + 1 + 1 + 2 = 5
            assertThat(lines("""
                    void f(boolean c1, boolean c2, boolean c3) {
                        if (c1) { g(); }
                        else if (c2) { g(); }
                        else {
                            if (c3) { g(); }
                        }
                    }
                    """)).containsExactly("if +1", "else if +1", "else +1", "if +2 (nesting 1)");
        }
    }

    @Nested
    @DisplayName("increments are reported per line, so a score can be rebuilt by hand")
    class Explanation {
        @Test
        void everyIncrementCarriesItsLineReasonAndRunningCost() {
            CognitiveComplexity.Score score = CognitiveComplexity.of(parse("""
                    void f(java.util.List<String> xs, boolean c) {
                        for (String x : xs) {
                            if (c && x.isEmpty()) { g(); }
                        }
                    }
                    """));
            assertThat(score.increments()).extracting("line", "reason", "cost", "nesting")
                    .containsExactly(
                            org.assertj.core.groups.Tuple.tuple(3, "for-each", 1, 0),
                            org.assertj.core.groups.Tuple.tuple(4, "if", 2, 1),
                            org.assertj.core.groups.Tuple.tuple(4, "&&", 1, 0));
            assertThat(score.total()).isEqualTo(4);
        }
    }
}
