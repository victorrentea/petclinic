package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Element;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deployment diagram guardrail — the hand-drawn picture against what actually ran.
 *
 * <p>{@code docs/deployment.drawio.png} is a real draw.io file — see {@link DrawioDiagram}
 * for how the picture carries its own mxGraph XML. That is only worth something if the
 * picture is machine-checkable, which is why every box and every arrow carries metadata:
 *
 * <ul>
 *   <li>a container declares {@code traceParticipant="…"} — the name it answers to in a
 *       trace ({@code Browser}, {@code Backend}, {@code DB});</li>
 *   <li>an arrow between two such containers declares {@code traced="yes"|"no"} — whether
 *       a real request crossing it should show up in a trace. A human clicking is not a
 *       span, so the actor arrows are {@code no}.</li>
 * </ul>
 *
 * <p>The other side of the comparison is not a second drawing: it is
 * {@code petclinic-test/src/*.genseq.puml}, generated from real OpenTelemetry traces of
 * the Playwright suite. So this test asks the only question that matters about an
 * architecture diagram — <b>is it still true?</b> — in both directions:
 *
 * <ol>
 *   <li>every arrow the diagram claims is traced really happened;</li>
 *   <li>every call the traces recorded is on the diagram;</li>
 *   <li>no arrow between two traced containers is left undeclared, so adding one forces
 *       the decision rather than silently opting out of the check.</li>
 * </ol>
 *
 * <p>Only solid PlantUML arrows ({@code ->}) count. A dashed {@code -->} is the return leg
 * of a call already counted, and self-calls ({@code Backend -> Backend}) are internal.
 */
class DeploymentDiagramTest {

    private static final Path DIAGRAM = Paths.get("docs/deployment.drawio.png");
    private static final Path TRACE_DIAGRAMS = Paths.get("../petclinic-test/src");

    /** A call from one deployed container to another, named as the traces name them. */
    private static DrawioDiagram diagram() throws Exception {
        return DrawioDiagram.read(DIAGRAM);
    }

    private record Edge(String from, String to) {
        @Override
        public String toString() {
            return from + " -> " + to;
        }
    }

    @Test
    void everyArrowTheDiagramCallsTracedReallyHappened() throws Exception {
        Set<Edge> drawn = tracedEdges(diagram());
        Set<Edge> observed = observedEdges();

        assertThat(drawn)
                .describedAs("Arrows in %s marked traced=\"yes\" that no trace shows. Either the "
                        + "call is gone and the diagram is stale, or the Playwright scenarios "
                        + "tagged @generate_sequence no longer exercise it.", DIAGRAM)
                .isSubsetOf(observed);
    }

    @Test
    void everyCallTheTracesRecordedIsOnTheDiagram() throws Exception {
        Set<Edge> drawn = tracedEdges(diagram());
        Set<Edge> observed = observedEdges();

        assertThat(observed)
                .describedAs("Calls the traces recorded that %s does not draw. The deployment "
                        + "grew a connection the picture never learned about — add the arrow and "
                        + "mark it traced=\"yes\".", DIAGRAM)
                .isNotEmpty()
                .isSubsetOf(drawn);
    }

    @Test
    void everyArrowBetweenTracedContainersDeclaresWhetherItIsTraced() throws Exception {
        DrawioDiagram diagram = diagram();
        Map<String, String> participants = participantsById(diagram);
        List<String> undeclared = new ArrayList<>();

        for (Element edge : diagram.cells(true)) {
            String from = participants.get(edge.getAttribute("source"));
            String to = participants.get(edge.getAttribute("target"));
            if (from == null || to == null) {
                continue; // an arrow touching a person or a note claims nothing
            }
            String traced = DrawioDiagram.attribute(edge, "traced");
            if (!"yes".equals(traced) && !"no".equals(traced)) {
                undeclared.add(from + " -> " + to);
            }
        }

        assertThat(undeclared)
                .describedAs("Arrows in %s between two traced containers with no traced=\"yes|no\" "
                        + "attribute. An undeclared arrow opts itself out of this guardrail in "
                        + "silence, which is the drift the guardrail exists to catch.", DIAGRAM)
                .isEmpty();
    }

    // ── the diagram side ──────────────────────────────────────────────────────────

    /** Cell id → the participant name that container answers to in a trace. */
    private static Map<String, String> participantsById(DrawioDiagram diagram) {
        Map<String, String> byId = new LinkedHashMap<>();
        for (Element cell : diagram.cells(false)) {
            String participant = DrawioDiagram.attribute(cell, "traceParticipant");
            if (!participant.isEmpty()) {
                byId.put(DrawioDiagram.id(cell), participant);
            }
        }
        assertThat(byId.values())
                .describedAs("containers in %s carrying traceParticipant=\"…\"", DIAGRAM)
                .isNotEmpty();
        return byId;
    }

    private static Set<Edge> tracedEdges(DrawioDiagram diagram) {
        Map<String, String> participants = participantsById(diagram);
        Set<Edge> edges = new LinkedHashSet<>();
        for (Element edge : diagram.cells(true)) {
            if (!"yes".equals(DrawioDiagram.attribute(edge, "traced"))) {
                continue;
            }
            String from = participants.get(edge.getAttribute("source"));
            String to = participants.get(edge.getAttribute("target"));
            assertThat(from).describedAs("source of a traced arrow in %s is not a traced "
                    + "container", DIAGRAM).isNotNull();
            assertThat(to).describedAs("target of a traced arrow in %s is not a traced "
                    + "container", DIAGRAM).isNotNull();
            edges.add(new Edge(from, to));
        }
        return edges;
    }

    // ── the trace side ────────────────────────────────────────────────────────────

    /** {@code A -> B} in a solid arrow, out of the PlantUML the traces generated. */
    private static final Pattern CALL = Pattern.compile("^\\s*(\\w+)\\s+->\\s+(\\w+)\\s*:", Pattern.MULTILINE);

    private static Set<Edge> observedEdges() throws IOException {
        Set<Edge> edges = new LinkedHashSet<>();
        List<Path> sources;
        try (Stream<Path> files = Files.list(TRACE_DIAGRAMS)) {
            sources = files.filter(p -> p.getFileName().toString().endsWith(".genseq.puml")).toList();
        }
        assertThat(sources)
                .describedAs("trace-generated sequence diagrams under %s — without them this "
                        + "guardrail compares the diagram against nothing", TRACE_DIAGRAMS)
                .isNotEmpty();

        for (Path source : sources) {
            Matcher m = CALL.matcher(Files.readString(source));
            while (m.find()) {
                if (!m.group(1).equals(m.group(2))) { // a self-call stays inside one container
                    edges.add(new Edge(m.group(1), m.group(2)));
                }
            }
        }
        return edges;
    }
}
