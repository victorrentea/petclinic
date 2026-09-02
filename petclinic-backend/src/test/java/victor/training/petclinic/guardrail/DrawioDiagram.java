package victor.training.petclinic.guardrail;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.Inflater;
import java.util.zip.InflaterInputStream;

/**
 * A committed {@code *.drawio.png} read back as a graph.
 *
 * <p>These files are real draw.io documents: the PNG is the picture and the mxGraph XML
 * is embedded in its text chunks, so one committed artifact both renders on GitHub and
 * opens for editing in the draw.io desktop app. That is only worth something if the
 * picture is machine-checkable, which is what this class is for — it hands a guardrail
 * the cells and their custom attributes, and knows nothing about any one diagram's
 * meaning.
 *
 * <p>Custom attributes live on the {@code <object>} draw.io wraps around a cell the
 * moment it is given any, and the id moves there too, so {@link #attribute} asks both.
 */
class DrawioDiagram {

    private final Path file;
    private final String xml;
    private final Document doc;

    private DrawioDiagram(Path file, String xml) throws Exception {
        this.file = file;
        this.xml = xml;
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        this.doc = factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    static DrawioDiagram read(Path png) throws Exception {
        if (!Files.isRegularFile(png)) {
            throw new AssertionError(png + " is missing — the committed diagram is the input "
                    + "to this guardrail, so without it there is nothing to check.");
        }
        return new DrawioDiagram(png, decodeDiagrams(embeddedXml(png, Files.readAllBytes(png))));
    }

    Path file() {
        return file;
    }

    String xml() {
        return xml;
    }

    /** Every mxCell that is an edge (or, with {@code edges} false, that is not). */
    List<Element> cells(boolean edges) {
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

    /** The cells drawn inside another — for an edge, its labels. */
    List<Element> childrenOf(String parentId) {
        List<Element> out = new ArrayList<>();
        for (Element cell : cells(false)) {
            if (parentId.equals(cell.getAttribute("parent"))) {
                out.add(cell);
            }
        }
        return out;
    }

    static String attribute(Element cell, String name) {
        if (!cell.getAttribute(name).isEmpty()) {
            return cell.getAttribute(name);
        }
        var parent = cell.getParentNode();
        return parent instanceof Element e && e.getTagName().equals("object")
                ? e.getAttribute(name)
                : "";
    }

    static String id(Element cell) {
        return attribute(cell, "id");
    }

    /** A cell's own label, which draw.io keeps as {@code value} until an object wraps it. */
    static String label(Element cell) {
        String value = cell.getAttribute("value");
        if (!value.isEmpty()) {
            return value;
        }
        return attribute(cell, "label");
    }

    /**
     * Where a child label sits along its edge: -1 at the source end, +1 at the target end,
     * 0 in the middle. draw.io stores it as the geometry's {@code x} when
     * {@code relative="1"}.
     */
    static double positionAlongEdge(Element labelCell) {
        NodeList geometries = labelCell.getElementsByTagName("mxGeometry");
        if (geometries.getLength() == 0) {
            return 0;
        }
        String x = ((Element) geometries.item(0)).getAttribute("x");
        return x.isEmpty() ? 0 : Double.parseDouble(x);
    }

    // ── PNG → mxGraph XML ─────────────────────────────────────────────────────────

    /**
     * The {@code mxfile} payload out of the PNG's text chunks. draw.io writes it as
     * uncompressed {@code tEXt} under the keyword {@code mxfile} when you save from the
     * desktop app, and as zlib-compressed {@code zTXt} under {@code mxGraphModel} when the
     * CLI exports with {@code --embed-diagram}; both are read here so the file survives a
     * round trip through either.
     */
    private static String embeddedXml(Path file, byte[] png) throws IOException {
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
            int split = indexOfZero(file, data, 0);
            String keyword = new String(data, 0, split, StandardCharsets.US_ASCII);
            if (!keyword.equals("mxfile") && !keyword.equals("mxGraphModel")) {
                continue;
            }
            return maybeUrlDecode(payload(file, chunk, data, split));
        }
        throw new AssertionError(file + " carries no draw.io metadata. It was exported as a "
                + "plain image, which makes it a picture nobody can edit or check — re-export "
                + "with the diagram embedded.");
    }

    private static String payload(Path file, String chunk, byte[] data, int split) throws IOException {
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
                int langEnd = indexOfZero(file, data, split + 3);
                int textStart = indexOfZero(file, data, langEnd + 1) + 1;
                InputStream raw = new ByteArrayInputStream(data, textStart, data.length - textStart);
                byte[] bytes = compressed == 1
                        ? new InflaterInputStream(raw).readAllBytes()
                        : raw.readAllBytes();
                return new String(bytes, StandardCharsets.UTF_8);
            }
        }
    }

    private static int indexOfZero(Path file, byte[] data, int from) {
        for (int i = from; i < data.length; i++) {
            if (data[i] == 0) {
                return i;
            }
        }
        throw new AssertionError("malformed PNG text chunk in " + file);
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
            byte[] buffer = new byte[Math.max(1024, deflated.length * 12)];
            int size = inflater.inflate(buffer);
            inflater.end();
            return maybeUrlDecode(new String(buffer, 0, size, StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new AssertionError("cannot read the compressed diagram", e);
        }
    }
}
