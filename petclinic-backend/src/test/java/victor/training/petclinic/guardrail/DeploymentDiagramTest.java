package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import java.util.zip.Inflater;
import java.util.zip.InflaterInputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deployment diagram guardrail — the hand-drawn picture against what actually ran.
 *
 * <p>{@code docs/deployment.drawio.png} is a real draw.io file: the PNG is the picture and
 * the mxGraph XML is embedded in it, so one committed artifact both renders on GitHub and
 * opens for editing in the draw.io desktop app. That is only worth something if the
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
    private record Edge(String from, String to) {
        @Override
        public String toString() {
            return from + " -> " + to;
        }
    }

    @Test
    void everyArrowTheDiagramCallsTracedReallyHappened() throws Exception {
        Set<Edge> drawn = tracedEdges(diagramXml());
        Set<Edge> observed = observedEdges();

        assertThat(drawn)
                .describedAs("Arrows in %s marked traced=\"yes\" that no trace shows. Either the "
                        + "call is gone and the diagram is stale, or the Playwright scenarios "
                        + "tagged @generate_sequence no longer exercise it.", DIAGRAM)
                .isSubsetOf(observed);
    }

    @Test
    void everyCallTheTracesRecordedIsOnTheDiagram() throws Exception {
        Set<Edge> drawn = tracedEdges(diagramXml());
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
        String xml = diagramXml();
        Map<String, String> participants = participantsById(xml);
        List<String> undeclared = new ArrayList<>();

        for (Element edge : cells(xml, true)) {
            String from = participants.get(edge.getAttribute("source"));
            String to = participants.get(edge.getAttribute("target"));
            if (from == null || to == null) {
                continue; // an arrow touching a person or a note claims nothing
            }
            String traced = attributeOfCellOrItsObject(edge, "traced");
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

    /** The mxGraph XML that the .drawio.png carries in its own metadata. */
    private static String diagramXml() throws IOException {
        assertThat(DIAGRAM).describedAs("the committed deployment diagram").exists();
        return decodeDiagrams(embeddedXml(Files.readAllBytes(DIAGRAM)));
    }

    /**
     * The {@code mxfile} payload out of the PNG's text chunks. draw.io writes it as
     * uncompressed {@code tEXt} under the keyword {@code mxfile} when you save from the
     * desktop app, and as zlib-compressed {@code zTXt} under {@code mxGraphModel} when the
     * CLI exports with {@code --embed-diagram}; both are read here so the file survives a
     * round trip through either.
     */
    private static String embeddedXml(byte[] png) throws IOException {
        DataInputStream in = new DataInputStream(new ByteArrayInputStream(png));
        in.skipBytes(8); // the PNG signature
        while (in.available() > 0) {
            int length = in.readInt();
            byte[] type = new byte[4];
            in.readFully(type);
            byte[] data = new byte[length];
            in.readFully(data);
            in.skipBytes(4); // CRC
            String chunk = new String(type, StandardCharsets.US_ASCII);
            if (!chunk.equals("tEXt") && !chunk.equals("zTXt") && !chunk.equals("iTXt")) {
                if (chunk.equals("IEND")) {
                    break;
                }
                continue;
            }
            int split = indexOfZero(data, 0);
            String keyword = new String(data, 0, split, StandardCharsets.US_ASCII);
            if (!keyword.equals("mxfile") && !keyword.equals("mxGraphModel")) {
                continue;
            }
            return maybeUrlDecode(payload(chunk, data, split));
        }
        throw new AssertionError(DIAGRAM + " carries no draw.io metadata. It was exported as a "
                + "plain image, which makes it a picture nobody can edit or check — re-export "
                + "with the diagram embedded.");
    }

    private static String payload(String chunk, byte[] data, int split) throws IOException {
        switch (chunk) {
            case "tEXt" :
                return new String(data, split + 1, data.length - split - 1, StandardCharsets.UTF_8);
            case "zTXt" : {
                // keyword \0 compressionMethod(1) then the zlib stream
                InputStream raw = new ByteArrayInputStream(data, split + 2, data.length - split - 2);
                return new String(new InflaterInputStream(raw).readAllBytes(), StandardCharsets.UTF_8);
            }
            default : {
                // iTXt: keyword \0 flag(1) method(1) langTag \0 translatedKeyword \0 text
                int compressed = data[split + 1];
                int langEnd = indexOfZero(data, split + 3);
                int textStart = indexOfZero(data, langEnd + 1) + 1;
                InputStream raw = new ByteArrayInputStream(data, textStart, data.length - textStart);
                byte[] bytes = compressed == 1
                        ? new InflaterInputStream(raw).readAllBytes()
                        : raw.readAllBytes();
                return new String(bytes, StandardCharsets.UTF_8);
            }
        }
    }

    private static int indexOfZero(byte[] data, int from) {
        for (int i = from; i < data.length; i++) {
            if (data[i] == 0) {
                return i;
            }
        }
        throw new AssertionError("malformed PNG text chunk in " + DIAGRAM);
    }

    /** draw.io percent-encodes the XML before storing it; a raw {@code <} means it did not. */
    private static String maybeUrlDecode(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("<")) {
            return trimmed;
        }
        // decode() also maps '+' to a space, which encodeURIComponent never produces.
        return URLDecoder.decode(trimmed.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    /**
     * Each {@code <diagram>}'s own body, which draw.io may store deflated and base64'd
     * when "compressed" is on. Left alone when it is already XML.
     */
    private static String decodeDiagrams(String mxfile) {
        Matcher m = Pattern.compile("<diagram[^>]*>(.*?)</diagram>", Pattern.DOTALL).matcher(mxfile);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String body = m.group(1).trim();
            m.appendReplacement(out, Matcher.quoteReplacement(
                    body.startsWith("<") ? body : inflateRaw(body)));
        }
        m.appendTail(out);
        return out.length() == 0 ? mxfile : out.toString();
    }

    private static String inflateRaw(String base64) {
        try {
            byte[] deflated = Base64.getDecoder().decode(base64);
            Inflater inflater = new Inflater(true); // raw deflate, no zlib header
            inflater.setInput(deflated);
            ByteArrayOutputStream inflated = new ByteArrayOutputStream(deflated.length * 12);
            try {
                byte[] buffer = new byte[8192];
                while (!inflater.finished()) {
                    int size = inflater.inflate(buffer);
                    if (size == 0 && (inflater.needsInput() || inflater.needsDictionary())) {
                        break;
                    }
                    inflated.write(buffer, 0, size);
                }
            } finally {
                inflater.end();
            }
            return maybeUrlDecode(inflated.toString(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new AssertionError("cannot read the compressed diagram inside " + DIAGRAM, e);
        }
    }

    /** Cell id → the participant name that container answers to in a trace. */
    private static Map<String, String> participantsById(String xml) throws Exception {
        Map<String, String> byId = new LinkedHashMap<>();
        for (Element cell : cells(xml, false)) {
            String participant = attributeOfCellOrItsObject(cell, "traceParticipant");
            if (!participant.isEmpty()) {
                byId.put(idOf(cell), participant);
            }
        }
        assertThat(byId.values())
                .describedAs("containers in %s carrying traceParticipant=\"…\"", DIAGRAM)
                .isNotEmpty();
        return byId;
    }

    private static Set<Edge> tracedEdges(String xml) throws Exception {
        Map<String, String> participants = participantsById(xml);
        Set<Edge> edges = new LinkedHashSet<>();
        for (Element edge : cells(xml, true)) {
            if (!"yes".equals(attributeOfCellOrItsObject(edge, "traced"))) {
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

    /** Every mxCell that is an edge (or, with {@code edges} false, that is not). */
    private static List<Element> cells(String xml, boolean edges) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        var doc = factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        NodeList all = doc.getElementsByTagName("mxCell");
        List<Element> out = new ArrayList<>();
        for (int i = 0; i < all.getLength(); i++) {
            Element cell = (Element) all.item(i);
            if ("1".equals(cell.getAttribute("edge")) == edges) {
                out.add(cell);
            }
        }
        return out;
    }

    /**
     * Custom attributes live on the {@code <object>} draw.io wraps around a cell the
     * moment it is given any; the id moves there too. So both are asked, cell first.
     */
    private static String attributeOfCellOrItsObject(Element cell, String name) {
        if (!cell.getAttribute(name).isEmpty()) {
            return cell.getAttribute(name);
        }
        var parent = cell.getParentNode();
        return parent instanceof Element e && e.getTagName().equals("object")
                ? e.getAttribute(name)
                : "";
    }

    private static String idOf(Element cell) {
        return attributeOfCellOrItsObject(cell, "id");
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
