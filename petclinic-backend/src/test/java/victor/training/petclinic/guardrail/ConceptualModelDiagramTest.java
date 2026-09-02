package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Element;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Conceptual model guardrail — the hand-arranged map against the code.
 *
 * <p>{@code docs/ConceptualModel.drawio.png} draws the same concepts and links as the
 * generated {@code DomainModel.puml}, and exists because of the one thing a generated
 * diagram cannot do: <b>stay in the same place</b>. PlantUML re-lays out the whole graph
 * on every regeneration, so adding one class moves Owner across the page and erases the
 * spatial memory of everyone who had learned the map. Here the layout belongs to the
 * humans, and only the layout does.
 *
 * <p>The split is what makes both halves safe:
 * <ul>
 *   <li><b>content is the code's</b> — this test refuses a box, a line or a cardinality
 *       that the domain classes do not have, and refuses a missing one just as hard;</li>
 *   <li><b>position is the human's</b> — nothing here reads a coordinate as truth, so a
 *       box can be dragged anywhere without breaking a check.</li>
 * </ul>
 *
 * <p>Identity is declared, never guessed from the drawn text: a box carries
 * {@code concept="Owner"} and a line {@code assoc="Owner-Pet"} (the two ends
 * alphabetically). Renaming the label in draw.io therefore cannot fool the check, and a
 * box may be restyled, resized or moved freely.
 *
 * <p>Cardinalities are read from the <b>visible</b> end labels rather than from an
 * attribute. An attribute would be a second copy of the same claim, free to drift from
 * what the picture shows — and a diagram that passes its guardrail while showing the
 * wrong number is worse than no guardrail. The map marks only what is worth reading: a
 * bare {@code *} at a many end, and <b>nothing</b> at a to-one end, where an unmarked line
 * says "exactly one". Silence is a claim like any other here, so the test asserts it —
 * a stray marker on a to-one end fails just as a missing {@code *} does.
 *
 * <p>When the model grows, {@code docs/scripts/conceptual-model-patch.py} adds the new box
 * or line in the staging lane down the left-hand side and marks it {@code placed="auto"};
 * {@link #nothingIsStillWaitingInTheStagingLane()} then fails until a human has dragged
 * it where it belongs. An automatic layout would be quicker and would cost the thing this
 * diagram is for.
 */
class ConceptualModelDiagramTest {

    private static final Path DIAGRAM = Paths.get("docs/ConceptualModel.drawio.png");

    private final DomainModelExtractor model = new DomainModelExtractor();

    // ── concepts ──────────────────────────────────────────────────────────────────

    @Test
    void everyConceptInTheCodeIsOnTheMap() throws Exception {
        assertThat(conceptsById(diagram()).values())
                .describedAs("Domain classes missing from %s. The model grew a concept the map "
                        + "never learned about — run docs/scripts/conceptual-model-patch.py to drop "
                        + "it into the staging lane, then drag it where it belongs.", DIAGRAM)
                .containsAll(conceptNames());
    }

    @Test
    void everyBoxOnTheMapIsARealConcept() throws Exception {
        assertThat(conceptsById(diagram()).values())
                .describedAs("Boxes in %s declaring a concept that no longer exists in the domain "
                        + "package. The class was renamed or deleted and the map still shows it.",
                        DIAGRAM)
                .isSubsetOf(conceptNames());
    }

    // ── links ─────────────────────────────────────────────────────────────────────

    @Test
    void everyAssociationInTheCodeIsDrawn() throws Exception {
        assertThat(drawnAssociations(diagram()).keySet())
                .describedAs("Associations between domain classes that %s does not draw. Run "
                        + "docs/scripts/conceptual-model-patch.py to add the line, then route it.",
                        DIAGRAM)
                .containsAll(expectedAssociations().keySet());
    }

    @Test
    void everyLineDrawnIsARealAssociation() throws Exception {
        assertThat(drawnAssociations(diagram()).keySet())
                .describedAs("Lines in %s between concepts that no field connects. The link was "
                        + "removed from the code, or was never there.", DIAGRAM)
                .isSubsetOf(expectedAssociations().keySet());
    }

    @Test
    void everyLineShowsTheRightCardinalitiesAtTheRightEnds() throws Exception {
        Map<String, DomainModelExtractor.Association> expected = expectedAssociations();
        List<String> wrong = new ArrayList<>();

        for (var drawn : drawnAssociations(diagram()).entrySet()) {
            DomainModelExtractor.Association truth = expected.get(drawn.getKey());
            if (truth == null) {
                continue; // a line about nothing: everyLineDrawnIsARealAssociation says so
            }
            Link link = drawn.getValue();
            for (var end : Map.of(link.from(), link.fromCardinality(),
                    link.to(), link.toCardinality()).entrySet()) {
                String shown = end.getValue();
                String required = marker(truth.cardinalityAt(end.getKey()));
                if (!required.equals(shown)) {
                    wrong.add("%s: %s at the %s end, should be %s"
                            .formatted(drawn.getKey(), describe(shown), end.getKey(),
                                    describe(required)));
                }
            }
        }

        assertThat(wrong)
                .describedAs("Cardinalities in %s that the fields contradict. A collection field "
                        + "earns a \"*\" at that end; a single reference is left unmarked.", DIAGRAM)
                .isEmpty();
    }

    @Test
    void everyLineBetweenTwoConceptsDeclaresWhichAssociationItIs() throws Exception {
        DrawioDiagram diagram = diagram();
        Map<String, String> concepts = conceptsById(diagram);
        List<String> undeclared = new ArrayList<>();

        for (Element edge : diagram.cells(true)) {
            String from = concepts.get(edge.getAttribute("source"));
            String to = concepts.get(edge.getAttribute("target"));
            if (from == null || to == null) {
                continue; // a line touching a note or a title claims nothing
            }
            if (DrawioDiagram.attribute(edge, "assoc").isEmpty()) {
                undeclared.add(from + " — " + to);
            }
        }

        assertThat(undeclared)
                .describedAs("Lines in %s between two concepts with no assoc=\"A-B\" attribute. An "
                        + "undeclared line opts itself out of this guardrail in silence, which is "
                        + "the drift the guardrail exists to catch.", DIAGRAM)
                .isEmpty();
    }

    // ── the staging lane ──────────────────────────────────────────────────────────

    @Test
    void nothingIsStillWaitingInTheStagingLane() throws Exception {
        DrawioDiagram diagram = diagram();
        List<String> waiting = new ArrayList<>();

        for (Element cell : diagram.cells(false)) {
            if (!"auto".equals(DrawioDiagram.attribute(cell, "placed"))) {
                continue;
            }
            if (stillWhereItWasDropped(cell)) {
                String what = DrawioDiagram.attribute(cell, "concept");
                waiting.add(what.isEmpty() ? DrawioDiagram.id(cell) : what);
            }
        }

        assertThat(waiting)
                .describedAs("Concepts parked in the staging lane of %s, still exactly where the "
                        + "patch script dropped them. Open the file in the draw.io desktop app, "
                        + "move each one to where it belongs on the map, save, and re-run "
                        + "docs/scripts/conceptual-model-patch.py to clear the marker.", DIAGRAM)
                .isEmpty();
    }

    /** True while the cell sits on the exact coordinates the patch script wrote. */
    private boolean stillWhereItWasDropped(Element cell) {
        String droppedAt = DrawioDiagram.attribute(cell, "autoAt");
        if (droppedAt.isEmpty()) {
            return true; // marked auto with no record of where: treat as unplaced
        }
        var geometry = cell.getElementsByTagName("mxGeometry");
        if (geometry.getLength() == 0) {
            return true;
        }
        Element g = (Element) geometry.item(0);
        return droppedAt.equals(g.getAttribute("x") + "," + g.getAttribute("y"));
    }

    // ── the code side ─────────────────────────────────────────────────────────────

    private List<String> conceptNames() {
        return model.domainClasses().stream().map(Class::getSimpleName).toList();
    }

    private Map<String, DomainModelExtractor.Association> expectedAssociations() {
        Map<String, DomainModelExtractor.Association> byKey = new TreeMap<>();
        for (DomainModelExtractor.Association a : model.associations(model.domainClasses())) {
            byKey.put(a.key(), a);
        }
        return byKey;
    }

    // ── the diagram side ──────────────────────────────────────────────────────────

    /** One line as the picture draws it, named by the concepts at its two ends. */
    private record Link(String from, String fromCardinality, String to, String toCardinality) {
    }

    private static DrawioDiagram diagram() throws Exception {
        return DrawioDiagram.read(DIAGRAM);
    }

    /** Cell id → the concept that box declares itself to be. */
    private Map<String, String> conceptsById(DrawioDiagram diagram) {
        Map<String, String> byId = new LinkedHashMap<>();
        for (Element cell : diagram.cells(false)) {
            String concept = DrawioDiagram.attribute(cell, "concept");
            if (!concept.isEmpty()) {
                byId.put(DrawioDiagram.id(cell), concept);
            }
        }
        assertThat(byId.values())
                .describedAs("boxes in %s carrying concept=\"…\"", DIAGRAM)
                .isNotEmpty();
        return byId;
    }

    /** Declared association key → what the picture actually shows for it. */
    private Map<String, Link> drawnAssociations(DrawioDiagram diagram) {
        Map<String, String> concepts = conceptsById(diagram);
        Map<String, Link> byKey = new LinkedHashMap<>();
        Set<String> seen = new LinkedHashSet<>();

        for (Element edge : diagram.cells(true)) {
            String key = DrawioDiagram.attribute(edge, "assoc");
            if (key.isEmpty()) {
                continue; // everyLineBetweenTwoConceptsDeclaresWhichAssociationItIs catches these
            }
            assertThat(seen.add(key))
                    .describedAs("%s draws the association %s twice; a link belongs on the map "
                            + "once, or the reader has to work out which copy is current.",
                            DIAGRAM, key)
                    .isTrue();

            String from = concepts.get(edge.getAttribute("source"));
            String to = concepts.get(edge.getAttribute("target"));
            assertThat(from).describedAs("the source end of line %s in %s is not a concept box",
                    key, DIAGRAM).isNotNull();
            assertThat(to).describedAs("the target end of line %s in %s is not a concept box",
                    key, DIAGRAM).isNotNull();

            byKey.put(key, new Link(from, cardinalityAt(diagram, edge, -1),
                    to, cardinalityAt(diagram, edge, 1)));
        }
        return byKey;
    }

    /** What the map should show at an end the code gives this cardinality. */
    private static String marker(String cardinality) {
        return DomainModelExtractor.MANY.equals(cardinality) ? "*" : "";
    }

    private static String describe(String marker) {
        return marker.isEmpty() ? "shows nothing" : "shows \"" + marker + "\"";
    }

    /**
     * The marker on the {@code side} half of the line (-1 source, +1 target), or the empty
     * string where the line carries none. draw.io keeps each as a child cell positioned
     * along the edge, so which end it belongs to is the sign of its own geometry — which
     * survives the human nudging it closer or further.
     */
    private String cardinalityAt(DrawioDiagram diagram, Element edge, int side) {
        for (Element label : diagram.childrenOf(DrawioDiagram.id(edge))) {
            double position = DrawioDiagram.positionAlongEdge(label);
            if (Math.signum(position) == side) {
                return DrawioDiagram.label(label);
            }
        }
        return "";
    }
}
