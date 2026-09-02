package victor.training.petclinic.guardrail;

import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.BodyDeclaration;
import com.github.javaparser.ast.body.CallableDeclaration;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.expr.BinaryExpr;
import com.github.javaparser.ast.expr.ConditionalExpr;
import com.github.javaparser.ast.expr.EnclosedExpr;
import com.github.javaparser.ast.expr.Expression;
import com.github.javaparser.ast.expr.LambdaExpr;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.expr.ObjectCreationExpr;
import com.github.javaparser.ast.expr.SwitchExpr;
import com.github.javaparser.ast.stmt.BreakStmt;
import com.github.javaparser.ast.stmt.CatchClause;
import com.github.javaparser.ast.stmt.ContinueStmt;
import com.github.javaparser.ast.stmt.DoStmt;
import com.github.javaparser.ast.stmt.ForEachStmt;
import com.github.javaparser.ast.stmt.ForStmt;
import com.github.javaparser.ast.stmt.IfStmt;
import com.github.javaparser.ast.stmt.LocalClassDeclarationStmt;
import com.github.javaparser.ast.stmt.Statement;
import com.github.javaparser.ast.stmt.SwitchEntry;
import com.github.javaparser.ast.stmt.SwitchStmt;
import com.github.javaparser.ast.stmt.TryStmt;
import com.github.javaparser.ast.stmt.WhileStmt;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Cognitive Complexity of ONE method, computed on the Java source AST, exactly as G. Ann
 * Campbell defined it for SonarSource ("Cognitive Complexity, a new way of measuring
 * understandability"). Unlike McCabe it answers "how hard is this to READ", by three rules:
 *
 * <ol>
 *   <li><b>increment</b> on every break in the linear flow — {@code if}, {@code else},
 *       {@code else if}, ternary, every loop, every {@code catch}, a {@code switch}, each
 *       sequence of like binary logical operators, recursion, a jump to a label;</li>
 *   <li><b>nesting penalty</b> — a structural increment sitting N levels deep costs
 *       {@code 1 + N}, so the same three branches cost 3 flat and 6 nested;</li>
 *   <li><b>no penalty for shorthand</b> — a {@code switch} costs 1 whatever the number of
 *       cases, and {@code else} / {@code else if} cost 1 with no nesting penalty.</li>
 * </ol>
 *
 * <p>{@code try} and {@code finally} cost nothing and do not nest; {@code catch} does both.
 * A lambda, anonymous class or local class costs nothing but nests its body one level deeper.
 *
 * <p>Every increment is kept with its line and its reason, which is what makes the score
 * explainable line by line instead of merely reportable — see
 * {@code endpoint-complexity-explained.html}.
 */
final class CognitiveComplexity {

    /** One charge against the score: {@code cost} = 1 + {@code nesting}, or just 1 when flat. */
    record Increment(int line, int cost, int nesting, String reason) {
    }

    record Score(int total, List<Increment> increments) {
    }

    private final List<Increment> increments = new ArrayList<>();
    private final String enclosingName;
    private final int enclosingArity;
    private final boolean overloaded;

    private CognitiveComplexity(CallableDeclaration<?> method) {
        this.enclosingName = method.getNameAsString();
        this.enclosingArity = method.getParameters().size();
        this.overloaded = method.findAncestor(TypeDeclaration.class)
                .map(type -> type.getMethodsByName(enclosingName).size() > 1)
                .orElse(false);
    }

    static Score of(CallableDeclaration<?> method) {
        CognitiveComplexity scorer = new CognitiveComplexity(method);
        bodyOf(method).ifPresent(body -> scorer.walk(body, 0));
        return new Score(scorer.increments.stream().mapToInt(Increment::cost).sum(), scorer.increments);
    }

    private static Optional<Statement> bodyOf(CallableDeclaration<?> method) {
        if (method instanceof MethodDeclaration m) {
            return m.getBody().map(b -> b);
        }
        if (method instanceof ConstructorDeclaration c) {
            return Optional.of(c.getBody());
        }
        return Optional.empty();
    }

    // ── The walk ───────────────────────────────────────────────────────────────

    private void walk(Node node, int nesting) {
        if (node instanceof IfStmt ifStmt) {
            if (!isElseIf(ifStmt)) { // an "else if" is consumed by the chain that owns it
                walkIfChain(ifStmt, nesting);
            }
        } else if (node instanceof ConditionalExpr ternary) {
            structural(ternary, "ternary", nesting);
            walk(ternary.getCondition(), nesting);
            walk(ternary.getThenExpr(), nesting + 1);
            walk(ternary.getElseExpr(), nesting + 1);
        } else if (node instanceof ForStmt loop) {
            List<Node> header = new ArrayList<>(loop.getInitialization());
            loop.getCompare().ifPresent(header::add);
            header.addAll(loop.getUpdate());
            walkLoop(loop, "for", nesting, loop.getBody(), header);
        } else if (node instanceof ForEachStmt loop) {
            walkLoop(loop, "for-each", nesting, loop.getBody(), List.of(loop.getIterable()));
        } else if (node instanceof WhileStmt loop) {
            walkLoop(loop, "while", nesting, loop.getBody(), List.of(loop.getCondition()));
        } else if (node instanceof DoStmt loop) {
            walkLoop(loop, "do-while", nesting, loop.getBody(), List.of(loop.getCondition()));
        } else if (node instanceof SwitchStmt sw) {
            walkSwitch(sw, sw.getSelector(), sw.getEntries(), nesting);
        } else if (node instanceof SwitchExpr sw) {
            walkSwitch(sw, sw.getSelector(), sw.getEntries(), nesting);
        } else if (node instanceof TryStmt tryStmt) {
            walkTry(tryStmt, nesting);
        } else if (node instanceof LambdaExpr lambda) {
            walk(lambda.getBody(), nesting + 1); // free, but its body reads one level deeper
        } else if (node instanceof LocalClassDeclarationStmt local) {
            walkNestedType(local.getClassDeclaration().getMembers(), nesting);
        } else if (node instanceof ObjectCreationExpr creation
                && creation.getAnonymousClassBody().isPresent()) {
            creation.getArguments().forEach(arg -> walk(arg, nesting));
            walkNestedType(creation.getAnonymousClassBody().get(), nesting);
        } else if (isLogicalSequenceRoot(node)) {
            walkLogicalSequence((BinaryExpr) node, nesting);
        } else {
            if (node instanceof MethodCallExpr call && isDirectRecursion(call)) {
                flat(call, "recursion");
            }
            if (isJumpToLabel(node)) {
                flat(node, node instanceof BreakStmt ? "break to label" : "continue to label");
            }
            node.getChildNodes().forEach(child -> walk(child, nesting));
        }
    }

    /**
     * {@code if} pays the nesting penalty; every {@code else if} / {@code else} after it pays a
     * flat 1 — the reader is following one decision, not entering a new one. Their bodies all
     * sit at the same depth, one below the {@code if}.
     */
    private void walkIfChain(IfStmt ifStmt, int nesting) {
        structural(ifStmt, "if", nesting);
        walk(ifStmt.getCondition(), nesting);
        walk(ifStmt.getThenStmt(), nesting + 1);
        Optional<Statement> elseStmt = ifStmt.getElseStmt();
        while (elseStmt.isPresent()) {
            if (elseStmt.get() instanceof IfStmt elseIf) {
                flat(elseIf, "else if");
                walk(elseIf.getCondition(), nesting);
                walk(elseIf.getThenStmt(), nesting + 1);
                elseStmt = elseIf.getElseStmt();
            } else {
                flat(elseStmt.get(), "else");
                walk(elseStmt.get(), nesting + 1);
                elseStmt = Optional.empty();
            }
        }
    }

    private void walkLoop(Node loop, String reason, int nesting, Statement body, List<? extends Node> header) {
        structural(loop, reason, nesting);
        header.forEach(node -> walk(node, nesting));
        walk(body, nesting + 1);
    }

    /** One increment for the whole switch, however many cases — rule (c). */
    private void walkSwitch(Node sw, Expression selector, List<SwitchEntry> entries, int nesting) {
        structural(sw, "switch", nesting);
        walk(selector, nesting);
        entries.forEach(entry -> {
            entry.getLabels().forEach(label -> walk(label, nesting));
            entry.getStatements().forEach(stmt -> walk(stmt, nesting + 1));
        });
    }

    /** {@code try} and {@code finally} are transparent; only {@code catch} is a break in flow. */
    private void walkTry(TryStmt tryStmt, int nesting) {
        tryStmt.getResources().forEach(resource -> walk(resource, nesting));
        walk(tryStmt.getTryBlock(), nesting);
        for (CatchClause clause : tryStmt.getCatchClauses()) {
            structural(clause, "catch", nesting);
            walk(clause.getBody(), nesting + 1);
        }
        tryStmt.getFinallyBlock().ifPresent(block -> walk(block, nesting));
    }

    private void walkNestedType(List<BodyDeclaration<?>> members, int nesting) {
        members.forEach(member -> {
            if (member instanceof CallableDeclaration<?> callable) {
                bodyOf(callable).ifPresent(body -> walk(body, nesting + 1));
            } else {
                member.getChildNodes().forEach(child -> walk(child, nesting + 1));
            }
        });
    }

    // ── Sequences of binary logical operators ──────────────────────────────────

    /**
     * {@code a && b && c} is one thought and costs 1; {@code a && b || c} is two and costs 2.
     * So: flatten the {@code &&}/{@code ||} tree left to right and charge 1 per RUN of the same
     * operator. Parentheses are transparent, {@code !} is not — it starts a fresh sequence,
     * which falls out of the recursion into the operands.
     */
    private void walkLogicalSequence(BinaryExpr root, int nesting) {
        List<BinaryExpr> operators = new ArrayList<>();
        List<Expression> operands = new ArrayList<>();
        flattenLogical(root, operators, operands);
        BinaryExpr.Operator previous = null;
        for (BinaryExpr operator : operators) {
            if (operator.getOperator() != previous) {
                flat(operator.getRight(), operator.getOperator().asString());
                previous = operator.getOperator();
            }
        }
        operands.forEach(operand -> walk(operand, nesting));
    }

    /** In-order: operators as the reader meets them, operands as the leaves between them. */
    private void flattenLogical(Expression expr, List<BinaryExpr> operators, List<Expression> operands) {
        Expression unwrapped = unwrapParentheses(expr);
        if (unwrapped instanceof BinaryExpr binary && isLogical(binary)) {
            flattenLogical(binary.getLeft(), operators, operands);
            operators.add(binary);
            flattenLogical(binary.getRight(), operators, operands);
        } else {
            operands.add(unwrapped);
        }
    }

    private boolean isLogicalSequenceRoot(Node node) {
        if (!(node instanceof BinaryExpr binary) || !isLogical(binary)) {
            return false;
        }
        Node parent = node;
        while (parent.getParentNode().orElse(null) instanceof EnclosedExpr parens) {
            parent = parens;
        }
        return !(parent.getParentNode().orElse(null) instanceof BinaryExpr outer && isLogical(outer));
    }

    private static boolean isLogical(BinaryExpr binary) {
        return binary.getOperator() == BinaryExpr.Operator.AND || binary.getOperator() == BinaryExpr.Operator.OR;
    }

    private static Expression unwrapParentheses(Expression expr) {
        Expression current = expr;
        while (current instanceof EnclosedExpr parens) {
            current = parens.getInner();
        }
        return current;
    }

    // ── The other flat increments ──────────────────────────────────────────────

    /**
     * Direct recursion only: an indirect cycle needs a call graph, which this class has not.
     * An OVERLOADED name is skipped entirely — {@code toSpecialty(List)} calling
     * {@code toSpecialty(SpecialtyDto)} is a delegation, not a cycle, and telling the two apart
     * needs a symbol solver. Undercounting a rare real case beats charging every MapStruct
     * collection mapper for a recursion it does not do.
     */
    private boolean isDirectRecursion(MethodCallExpr call) {
        boolean unqualified = call.getScope().map(scope -> scope.isThisExpr()).orElse(true);
        return !overloaded && unqualified && call.getNameAsString().equals(enclosingName)
                && call.getArguments().size() == enclosingArity;
    }

    private static boolean isJumpToLabel(Node node) {
        return node instanceof BreakStmt breakStmt && breakStmt.getLabel().isPresent()
                || node instanceof ContinueStmt continueStmt && continueStmt.getLabel().isPresent();
    }

    private static boolean isElseIf(IfStmt ifStmt) {
        return ifStmt.getParentNode().orElse(null) instanceof IfStmt parent
                && parent.getElseStmt().orElse(null) == ifStmt;
    }

    // ── Recording ──────────────────────────────────────────────────────────────

    private void structural(Node node, String reason, int nesting) {
        increments.add(new Increment(lineOf(node), 1 + nesting, nesting, reason));
    }

    private void flat(Node node, String reason) {
        increments.add(new Increment(lineOf(node), 1, 0, reason));
    }

    private static int lineOf(Node node) {
        return node.getBegin().map(position -> position.line).orElse(0);
    }
}
