package victor.training.petclinic.rewrite;

import org.openrewrite.Cursor;
import org.openrewrite.ExecutionContext;
import org.openrewrite.Recipe;
import org.openrewrite.TreeVisitor;
import org.openrewrite.java.JavaIsoVisitor;
import org.openrewrite.java.JavaVisitor;
import org.openrewrite.java.tree.Expression;
import org.openrewrite.java.tree.J;
import org.openrewrite.java.tree.JavaType;
import org.openrewrite.java.tree.Statement;

import java.util.ArrayList;
import java.util.List;

/**
 * Inlines a local variable into its single use, e.g.
 *
 * <pre>{@code
 *   PetType petType = petTypeRepository.findById(petTypeId).orElseThrow();
 *   return petTypeMapper.toPetTypeDto(petType);
 * }</pre>
 *
 * becomes
 *
 * <pre>{@code
 *   return petTypeMapper.toPetTypeDto(petTypeRepository.findById(petTypeId).orElseThrow());
 * }</pre>
 *
 * <h2>Why the guards matter</h2>
 * The whole point of the recipe is to <em>never</em> evaluate the initializer more than once.
 * A variable therefore qualifies only when ALL of the following hold:
 * <ol>
 *   <li>It is a single-variable declaration with an initializer.</li>
 *   <li>The initializer is a high-precedence expression (method call, {@code new}, field/array
 *       access, literal, identifier or a parenthesized expression) so it can be dropped verbatim
 *       into another expression without needing parentheses and without changing operator precedence.</li>
 *   <li>The variable is <strong>read exactly once</strong> in its scope. Two or more uses (as in
 *       {@code save(type); ...; type.getId()}) are left untouched, because inlining would re-evaluate
 *       the initializer. Zero uses are left untouched too (that is a different concern: dead code).</li>
 *   <li>That single read lives inside the <strong>immediately following statement</strong> and is reached
 *       only through side-effect-transparent expression nodes. This guarantees the initializer runs
 *       exactly once, unconditionally, in the same order as before — no reordering across intervening
 *       statements, and never inside a loop, lambda, conditional or short-circuit that could repeat,
 *       defer or skip it.</li>
 * </ol>
 */
public class InlineSingleUseLocalVariable extends Recipe {

    @Override
    public String getDisplayName() {
        return "Inline a local variable used exactly once";
    }

    @Override
    public String getDescription() {
        return "Replaces the single read of a local variable with its initializer and removes the " +
               "declaration, but only when the variable is used exactly once so the initializer is " +
               "never evaluated more than once. Variables used two or more times are left as-is.";
    }

    @Override
    public TreeVisitor<?, ExecutionContext> getVisitor() {
        return new JavaIsoVisitor<ExecutionContext>() {
            @Override
            public J.Block visitBlock(J.Block block, ExecutionContext ctx) {
                J.Block b = super.visitBlock(block, ctx);
                List<Statement> statements = b.getStatements();

                // Inline at most one variable per pass; the recipe re-runs to convergence, which keeps
                // chained/interdependent inlines from corrupting each other within a single pass.
                for (int i = 0; i + 1 < statements.size(); i++) {
                    if (!(statements.get(i) instanceof J.VariableDeclarations vd)) {
                        continue;
                    }
                    if (vd.getVariables().size() != 1) {
                        continue; // keep it simple: only single-variable declarations
                    }
                    J.VariableDeclarations.NamedVariable declared = vd.getVariables().get(0);
                    Expression initializer = declared.getInitializer();
                    JavaType.Variable declaredType = declared.getVariableType();
                    if (initializer == null || declaredType == null || !isSafeToInline(initializer)) {
                        continue;
                    }

                    List<Cursor> reads = findReferences(b, declaredType, declared.getName());
                    if (reads.size() != 1) {
                        continue; // 0 uses (dead code) or 2+ uses (would re-evaluate) => leave alone
                    }
                    Cursor use = reads.get(0);
                    if (isWriteTarget(use)) {
                        continue; // the single mention is an assignment/increment target, not a read
                    }

                    Statement nextStatement = statements.get(i + 1);
                    if (!executesExactlyOnceWithin(use, nextStatement)) {
                        continue;
                    }

                    Statement inlinedNext = (Statement) new ReplaceIdentifier(use.getValue(), initializer)
                            .visitNonNull(nextStatement, ctx);
                    List<Statement> rewritten = new ArrayList<>(statements);
                    rewritten.set(i + 1, inlinedNext);
                    rewritten.remove(i);
                    return b.withStatements(rewritten);
                }
                return b;
            }
        };
    }

    /**
     * Only inline initializers that are "primary"/postfix expressions: they carry the highest
     * precedence in Java, so substituting them into any surrounding expression cannot change how that
     * expression parses and never needs extra parentheses.
     */
    private static boolean isSafeToInline(Expression e) {
        return e instanceof J.MethodInvocation
               || e instanceof J.NewClass
               || e instanceof J.NewArray
               || e instanceof J.FieldAccess
               || e instanceof J.ArrayAccess
               || e instanceof J.Identifier
               || e instanceof J.Literal
               || e instanceof J.Parentheses;
    }

    /** Collect every read/write mention of {@code target} inside {@code scope}, excluding the declaration name. */
    private static List<Cursor> findReferences(J scope, JavaType.Variable target, J.Identifier declarationName) {
        List<Cursor> found = new ArrayList<>();
        new JavaIsoVisitor<List<Cursor>>() {
            @Override
            public J.Identifier visitIdentifier(J.Identifier identifier, List<Cursor> out) {
                if (identifier != declarationName && identifier.getFieldType() == target) {
                    out.add(getCursor());
                }
                return identifier;
            }
        }.visit(scope, found);
        return found;
    }

    /** True when the single mention is the target of an assignment or an increment/decrement (a write, not a read). */
    private static boolean isWriteTarget(Cursor identifierCursor) {
        J.Identifier id = identifierCursor.getValue();
        Object parent = identifierCursor.getParentTreeCursor().getValue();
        if (parent instanceof J.Assignment assignment) {
            return assignment.getVariable() == id;
        }
        if (parent instanceof J.AssignmentOperation assignmentOperation) {
            return assignmentOperation.getVariable() == id;
        }
        if (parent instanceof J.Unary unary) {
            return switch (unary.getOperator()) {
                case PreIncrement, PreDecrement, PostIncrement, PostDecrement -> unary.getExpression() == id;
                default -> false;
            };
        }
        return false;
    }

    /**
     * True when {@code use} sits inside {@code statement} and is reached only through
     * side-effect-transparent expression nodes — i.e. it is guaranteed to run exactly once,
     * unconditionally, whenever {@code statement} runs. Any loop, lambda, nested class, conditional,
     * ternary or short-circuit operator on the path makes this return false.
     */
    private static boolean executesExactlyOnceWithin(Cursor use, Statement statement) {
        Cursor c = use.getParentTreeCursor();
        while (true) {
            Object node = c.getValue();
            if (node == statement) {
                return isUnconditionalStatement(statement);
            }
            if (!isTransparentExpression(node)) {
                return false;
            }
            c = c.getParentTreeCursor();
            if (c.getValue() == Cursor.ROOT_VALUE) {
                return false; // walked past the statement without meeting it
            }
        }
    }

    /** Statements whose (relevant) sub-expressions run unconditionally exactly once when the statement runs. */
    private static boolean isUnconditionalStatement(Statement statement) {
        return statement instanceof J.Return
               || statement instanceof J.Throw
               || statement instanceof J.MethodInvocation
               || statement instanceof J.NewClass
               || statement instanceof J.Assignment
               || statement instanceof J.AssignmentOperation
               || statement instanceof J.Unary
               || statement instanceof J.VariableDeclarations;
    }

    /**
     * Expression nodes we are willing to walk <em>through</em> from the statement down to the use:
     * each evaluates its children unconditionally and exactly once. Deliberately excludes
     * {@link J.Ternary}, short-circuit {@link J.Binary} (&amp;&amp;, ||), lambdas, and anonymous classes.
     */
    private static boolean isTransparentExpression(Object node) {
        if (node instanceof J.MethodInvocation
            || node instanceof J.NewClass
            || node instanceof J.NewArray
            || node instanceof J.FieldAccess
            || node instanceof J.ArrayAccess
            || node instanceof J.Parentheses
            || node instanceof J.ControlParentheses
            || node instanceof J.TypeCast
            || node instanceof J.InstanceOf) {
            return true;
        }
        if (node instanceof J.Unary unary) {
            return switch (unary.getOperator()) {
                case PreIncrement, PreDecrement, PostIncrement, PostDecrement -> false;
                default -> true;
            };
        }
        if (node instanceof J.Binary binary) {
            return switch (binary.getOperator()) {
                case And, Or -> false; // short-circuit: right operand is conditional
                default -> true;
            };
        }
        return false;
    }

    /** Swaps a specific identifier instance for an expression, preserving the identifier's whitespace. */
    private static final class ReplaceIdentifier extends JavaVisitor<ExecutionContext> {
        private final J.Identifier target;
        private final Expression replacement;

        private ReplaceIdentifier(J.Identifier target, Expression replacement) {
            this.target = target;
            this.replacement = replacement;
        }

        @Override
        public J visitIdentifier(J.Identifier identifier, ExecutionContext ctx) {
            if (identifier == target) {
                return replacement.withPrefix(identifier.getPrefix());
            }
            return identifier;
        }
    }
}
