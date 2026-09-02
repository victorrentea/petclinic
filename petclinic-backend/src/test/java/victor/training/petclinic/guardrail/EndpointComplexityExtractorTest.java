package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;
import org.objectweb.asm.AnnotationVisitor;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.Handle;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Generates docs/generated/endpoint-complexity{,-explained}.{html,json}: the <b>Cognitive
 * Complexity</b> (G. Ann Campbell / SonarSource) of the WHOLE FLOW behind every entry point of
 * the app, not just of the annotated method.
 *
 * <p><b>Why two readers.</b> Cognitive Complexity charges an increment {@code 1 + nesting}, and
 * nesting is a source-level fact that javac erases: in bytecode an {@code if} inside a loop and
 * two sibling {@code if}s are the same pair of conditional jumps, a {@code switch} on strings is
 * a hash lookup plus an {@code equals} ladder, and {@code else} is not a construct at all.
 * Reconstructing that from the CFG would be guesswork, so the two questions are asked of the
 * reader that can actually answer them:
 * <ul>
 *   <li><b>ASM over target/classes</b> — the CALL GRAPH: every {@code invoke*} into our own
 *       package plus the lambda bodies behind {@code invokedynamic}, with abstract/interface
 *       calls re-pointed at the implementations found in target/classes. Bytecode wins here:
 *       it resolves method references, generated code and dispatch that no parser sees.</li>
 *   <li><b>JavaParser over src/main/java + target/generated-sources/annotations</b> — the SCORE
 *       per method, from the AST, which is where nesting still exists. See
 *       {@link CognitiveComplexity} for the rules and {@link JavaSourceIndex} for the matching.
 *       A method with no source (a Lombok accessor, a Spring Data query implemented at runtime)
 *       scores 0: cognitive complexity measures what a reader must hold in their head, and
 *       there is nothing there to read.</li>
 *   <li><b>Entry points</b> = every way the outside world gets into the app: @GetMapping /
 *       @PostMapping / ... in a @RestController (with the class-level @RequestMapping as path
 *       prefix), @McpTool tools, @KafkaListener / @RabbitListener / @JmsListener consumers and
 *       @Scheduled jobs. Each is tagged with its {@code kind} in the emitted JSON.</li>
 * </ul>
 *
 * <p>The headline number is the plain SUM of the per-method scores over the DISTINCT methods
 * reachable from the handler (cycles counted once). Cognitive Complexity is already 0 for
 * straight-line code, so summing needs none of McCabe's {@code -1} bookkeeping: a flow of forty
 * Lombok setters still scores 0.
 *
 * <p>Known limits: only static targets are known, so a call through an interface with several
 * implementations counts them ALL; runtime-generated code (Spring Data, proxies, AOP) is
 * invisible beyond its leaf; reflection is invisible; recursion is detected within a method,
 * not across the call graph.
 */
class EndpointComplexityExtractorTest {

    private static final String BASE_PKG = "victor/training/petclinic";
    private static final Path CLASSES_DIR = Paths.get("target/classes");
    private static final Path GENERATED_DIR = Paths.get("docs/generated");
    private static final List<Path> SOURCE_ROOTS = List.of(
            Paths.get("src/main/java"), Paths.get("target/generated-sources/annotations"));

    // ── Model ──────────────────────────────────────────────────────────────────

    /** owner is an internal name (victor/training/petclinic/rest/VisitRestController). */
    private record MethodKey(String owner, String name, String desc) {
        String simpleClass() {
            return owner.substring(owner.lastIndexOf('/') + 1).replace('$', '.');
        }

        String display() {
            return simpleClass() + "." + name + "(" + String.join(", ", simpleParameterTypes()) + ")";
        }

        /** Erased, unqualified — the form {@link JavaSourceIndex} can match against source. */
        List<String> simpleParameterTypes() {
            List<String> args = new ArrayList<>();
            for (Type t : Type.getArgumentTypes(desc)) {
                String name = t.getClassName();
                args.add(name.substring(name.lastIndexOf('.') + 1));
            }
            return args;
        }
    }

    private static class MethodInfo {
        boolean isAbstract;
        final Set<MethodKey> calls = new LinkedHashSet<>();
    }

    private static class ClassInfo {
        String name;
        String superName;
        List<String> interfaces = List.of();
        boolean isInterface;
        boolean isController;
        String pathPrefix = "";
        final Map<MethodKey, MethodInfo> methods = new LinkedHashMap<>();
        final List<Endpoint> endpoints = new ArrayList<>();
    }

    /**
     * One entry point. {@code verb} and {@code label} keep the JSON's original httpMethod/path
     * slots: for HTTP they are the verb and the URL, for the other kinds the transport and the
     * declared name (MCP tool name, topic, cron...).
     */
    private record Endpoint(String kind, String verb, String label, MethodKey key) {
    }

    private static final String HTTP = "http";
    private static final List<String> KINDS = List.of(HTTP, "mcp", "listener", "job");
    private static final Map<String, String> KIND_TITLES = Map.of(
            HTTP, "HTTP / REST APIs",
            "mcp", "MCP tools",
            "listener", "Message listeners",
            "job", "Jobs");

    /** An annotation that turns a method into an entry point, and where to read its label from. */
    private record EntryPointAnnotation(String kind, String verb, Set<String> labelAttributes) {
    }

    private static final Map<String, EntryPointAnnotation> ENTRY_POINT_ANNOTATIONS = Map.of(
            "Lorg/springaicommunity/mcp/annotation/McpTool;",
            new EntryPointAnnotation("mcp", "MCP", Set.of("name")),
            "Lorg/springframework/scheduling/annotation/Scheduled;",
            new EntryPointAnnotation("job", "JOB", Set.of("cron")),
            "Lorg/springframework/kafka/annotation/KafkaListener;",
            new EntryPointAnnotation("listener", "KAFKA", Set.of("topics")),
            "Lorg/springframework/amqp/rabbit/annotation/RabbitListener;",
            new EntryPointAnnotation("listener", "RABBIT", Set.of("queues")),
            "Lorg/springframework/jms/annotation/JmsListener;",
            new EntryPointAnnotation("listener", "JMS", Set.of("destination")));

    /** One method as it appears inside one endpoint's flow; {@code source} is null when unresolved. */
    private record Node(MethodKey key, int cognitive, String layer, JavaSourceIndex.SourceMethod source) {
        boolean unresolved() {
            return source == null;
        }
    }

    private record Flow(Endpoint endpoint, List<Node> nodes, int cognitive, int depth,
            Map<String, Integer> cognitiveByLayer) {
    }

    private final Map<String, ClassInfo> classes = new LinkedHashMap<>();
    private final Map<MethodKey, MethodInfo> allMethods = new HashMap<>();
    private JavaSourceIndex sourceIndex;

    @Test
    void generateEndpointComplexityReport() throws IOException {
        scanCompiledClasses();
        assertThat(classes).as("no classes found in %s — run through Maven so main is compiled",
                CLASSES_DIR.toAbsolutePath()).isNotEmpty();
        sourceIndex = new JavaSourceIndex(SOURCE_ROOTS);

        Map<MethodKey, Set<MethodKey>> resolvedCalls = resolveVirtualCalls();

        List<Flow> flows = collectEndpoints().stream()
                .map(endpoint -> walk(endpoint, resolvedCalls))
                .sorted(Comparator.comparingInt(Flow::cognitive).reversed()
                        .thenComparing(f -> f.endpoint().label()))
                .toList();

        assertThat(flows).as("no entry point found").isNotEmpty();
        assertThat(flows.stream().mapToInt(Flow::cognitive).max().orElse(0))
                .as("every flow scored 0 — the source index matched no compiled method")
                .isPositive();

        String explained = toExplainedHtml(flows);
        assertEveryScoreIsRebuildableFromTheReport(explained, flows);

        Files.createDirectories(GENERATED_DIR);
        Files.writeString(GENERATED_DIR.resolve("endpoint-complexity.json"), toJson(flows));
        Files.writeString(GENERATED_DIR.resolve("endpoint-complexity.html"), toHtml(flows));
        Files.writeString(GENERATED_DIR.resolve("endpoint-complexity-explained.html"), explained);

        assertThat(GENERATED_DIR.resolve("endpoint-complexity.html")).exists();
        assertThat(GENERATED_DIR.resolve("endpoint-complexity-explained.html")).exists();
    }

    /**
     * The whole point of the explained report: adding up its gutter must land on the headline
     * number. So the last running total rendered inside each entry point's section has to equal
     * that entry point's score — otherwise the report is telling a story the metric does not.
     */
    private void assertEveryScoreIsRebuildableFromTheReport(String html, List<Flow> flows) {
        Map<String, Integer> expected = flows.stream().filter(f -> f.cognitive() > 0)
                .collect(LinkedHashMap::new, (map, f) -> map.put(anchorOf(f), f.cognitive()), Map::putAll);
        assertThat(expected).as("no entry point costs anything — nothing to explain").isNotEmpty();

        Matcher sections = Pattern.compile("<details class=\"explained\" id=\"([^\"]+)\">(.*?)</details>",
                Pattern.DOTALL).matcher(html);
        Map<String, Integer> rendered = new LinkedHashMap<>();
        while (sections.find()) {
            Matcher totals = Pattern.compile("<td class=\"run\">(\\d+)</td>").matcher(sections.group(2));
            int last = 0;
            while (totals.find()) {
                last = Integer.parseInt(totals.group(1));
            }
            rendered.put(sections.group(1), last);
        }
        assertThat(rendered).as("running totals in the explained report").isEqualTo(expected);
    }

    // ── 1. Read every compiled class ───────────────────────────────────────────

    private void scanCompiledClasses() throws IOException {
        try (Stream<Path> files = Files.walk(CLASSES_DIR)) {
            List<Path> classFiles = files
                    .filter(p -> p.toString().endsWith(".class"))
                    .sorted()
                    .toList();
            for (Path file : classFiles) {
                try (InputStream in = Files.newInputStream(file)) {
                    ClassInfo info = new ClassInfo();
                    new ClassReader(in).accept(new ClassScanner(info), ClassReader.SKIP_FRAMES);
                    classes.put(info.name, info);
                    allMethods.putAll(info.methods);
                }
            }
        }
    }

    private class ClassScanner extends ClassVisitor {
        private final ClassInfo info;

        ClassScanner(ClassInfo info) {
            super(Opcodes.ASM9);
            this.info = info;
        }

        @Override
        public void visit(int version, int access, String name, String signature,
                String superName, String[] interfaces) {
            info.name = name;
            info.superName = superName;
            info.interfaces = interfaces == null ? List.of() : List.of(interfaces);
            info.isInterface = (access & Opcodes.ACC_INTERFACE) != 0;
        }

        @Override
        public AnnotationVisitor visitAnnotation(String descriptor, boolean visible) {
            if (isAnyOf(descriptor, "RestController", "Controller")) {
                info.isController = true;
            }
            if (isAnyOf(descriptor, "RequestMapping")) {
                return new MappingAnnotationVisitor(
                        (paths, verbs) -> info.pathPrefix = paths.isEmpty() ? "" : paths.get(0));
            }
            return null;
        }

        @Override
        public MethodVisitor visitMethod(int access, String name, String descriptor,
                String signature, String[] exceptions) {
            if ((access & Opcodes.ACC_BRIDGE) != 0) {
                return null; // compiler-inserted covariant forwarder — not real complexity
            }
            MethodKey key = new MethodKey(info.name, name, descriptor);
            MethodInfo method = new MethodInfo();
            method.isAbstract = (access & Opcodes.ACC_ABSTRACT) != 0
                    || (info.isInterface && (access & Opcodes.ACC_STATIC) == 0
                            && (access & Opcodes.ACC_PRIVATE) == 0 && isAbstractInterfaceBody(access));
            info.methods.put(key, method);
            return new MethodScanner(info, key, method);
        }

        private boolean isAbstractInterfaceBody(int access) {
            return (access & Opcodes.ACC_ABSTRACT) != 0;
        }

        private boolean isAnyOf(String descriptor, String... simpleNames) {
            for (String simple : simpleNames) {
                if (descriptor.endsWith("/" + simple + ";")) {
                    return true;
                }
            }
            return false;
        }
    }

    private class MethodScanner extends MethodVisitor {
        private final ClassInfo owner;
        private final MethodKey key;
        private final MethodInfo method;

        MethodScanner(ClassInfo owner, MethodKey key, MethodInfo method) {
            super(Opcodes.ASM9);
            this.owner = owner;
            this.key = key;
            this.method = method;
        }

        @Override
        public AnnotationVisitor visitAnnotation(String descriptor, boolean visible) {
            String verb = httpVerbOf(descriptor);
            if (verb != null) {
                return new MappingAnnotationVisitor((paths, verbs) -> {
                    String path = paths.isEmpty() ? "" : paths.get(0);
                    List<String> methods = verb.isEmpty() ? verbs : List.of(verb);
                    for (String httpMethod : methods.isEmpty() ? List.of("ANY") : methods) {
                        owner.endpoints.add(
                                new Endpoint(HTTP, httpMethod, join(owner.pathPrefix, path), key));
                    }
                });
            }
            EntryPointAnnotation entryPoint = ENTRY_POINT_ANNOTATIONS.get(descriptor);
            if (entryPoint == null) {
                return null;
            }
            return new LabelAnnotationVisitor(entryPoint.labelAttributes(), label -> owner.endpoints.add(
                    new Endpoint(entryPoint.kind(), entryPoint.verb(),
                            label.isEmpty() ? key.simpleClass() + "." + key.name() : label, key)));
        }

        /** "" for @RequestMapping (verb comes from its method attribute), null if not a mapping. */
        private String httpVerbOf(String descriptor) {
            if (!descriptor.startsWith("Lorg/springframework/web/bind/annotation/")) {
                return null;
            }
            String simple = descriptor.substring(descriptor.lastIndexOf('/') + 1, descriptor.length() - 1);
            return switch (simple) {
                case "GetMapping" -> "GET";
                case "PostMapping" -> "POST";
                case "PutMapping" -> "PUT";
                case "DeleteMapping" -> "DELETE";
                case "PatchMapping" -> "PATCH";
                case "RequestMapping" -> "";
                default -> null;
            };
        }

        @Override
        public void visitMethodInsn(int opcode, String owner, String name, String descriptor,
                boolean isInterface) {
            addCall(owner, name, descriptor);
        }

        @Override
        public void visitInvokeDynamicInsn(String name, String descriptor, Handle bootstrap,
                Object... bootstrapArgs) {
            for (Object arg : bootstrapArgs) { // the lambda body / method reference target
                if (arg instanceof Handle handle) {
                    addCall(handle.getOwner(), handle.getName(), handle.getDesc());
                }
            }
        }

        private void addCall(String owner, String name, String descriptor) {
            if (owner.startsWith(BASE_PKG)) {
                method.calls.add(new MethodKey(owner, name, descriptor));
            }
        }
    }

    /** Reads the value/path and method attributes of a Spring mapping annotation. */
    private static class MappingAnnotationVisitor extends AnnotationVisitor {
        private interface Sink {
            void accept(List<String> paths, List<String> verbs);
        }

        private final Sink sink;
        private final List<String> paths = new ArrayList<>();
        private final List<String> verbs = new ArrayList<>();

        MappingAnnotationVisitor(Sink sink) {
            super(Opcodes.ASM9);
            this.sink = sink;
        }

        @Override
        public AnnotationVisitor visitArray(String name) {
            boolean isPath = "value".equals(name) || "path".equals(name);
            boolean isVerb = "method".equals(name);
            if (!isPath && !isVerb) {
                return null;
            }
            return new AnnotationVisitor(Opcodes.ASM9) {
                @Override
                public void visit(String unused, Object value) {
                    if (isPath) {
                        paths.add(String.valueOf(value));
                    }
                }

                @Override
                public void visitEnum(String unused, String descriptor, String value) {
                    if (isVerb) {
                        verbs.add(value);
                    }
                }
            };
        }

        @Override
        public void visitEnd() {
            sink.accept(paths, verbs);
        }
    }

    /** Reads the attributes that name a non-HTTP entry point: a tool name, a topic, a cron. */
    private static class LabelAnnotationVisitor extends AnnotationVisitor {
        private final Set<String> labelAttributes;
        private final Consumer<String> sink;
        private final List<String> labels = new ArrayList<>();

        LabelAnnotationVisitor(Set<String> labelAttributes, Consumer<String> sink) {
            super(Opcodes.ASM9);
            this.labelAttributes = labelAttributes;
            this.sink = sink;
        }

        @Override
        public void visit(String name, Object value) {
            if (labelAttributes.contains(name)) {
                labels.add(String.valueOf(value));
            }
        }

        @Override
        public AnnotationVisitor visitArray(String name) {
            if (!labelAttributes.contains(name)) {
                return null;
            }
            return new AnnotationVisitor(Opcodes.ASM9) {
                @Override
                public void visit(String unused, Object value) {
                    labels.add(String.valueOf(value));
                }
            };
        }

        @Override
        public void visitEnd() {
            sink.accept(String.join(", ", labels));
        }
    }

    // ── 2. Re-point abstract/interface calls at their implementations ──────────

    private Map<MethodKey, Set<MethodKey>> resolveVirtualCalls() {
        Map<String, List<String>> implementorsOf = buildImplementorIndex();

        Map<MethodKey, Set<MethodKey>> resolved = new HashMap<>();
        for (Map.Entry<MethodKey, MethodInfo> entry : allMethods.entrySet()) {
            Set<MethodKey> targets = new LinkedHashSet<>();
            for (MethodKey call : entry.getValue().calls) {
                targets.addAll(implementationsOf(call, implementorsOf));
            }
            resolved.put(entry.getKey(), targets);
        }
        return resolved;
    }

    private Map<String, List<String>> buildImplementorIndex() {
        Map<String, List<String>> index = new HashMap<>();
        for (ClassInfo cls : classes.values()) {
            if (cls.isInterface) {
                continue;
            }
            for (String supertype : allSupertypesOf(cls)) {
                index.computeIfAbsent(supertype, k -> new ArrayList<>()).add(cls.name);
            }
        }
        return index;
    }

    private Set<String> allSupertypesOf(ClassInfo cls) {
        Set<String> found = new LinkedHashSet<>();
        Deque<String> pending = new ArrayDeque<>();
        pending.add(cls.name);
        while (!pending.isEmpty()) {
            ClassInfo current = classes.get(pending.poll());
            if (current == null) {
                continue;
            }
            for (String supertype : concat(current.superName, current.interfaces)) {
                if (found.add(supertype)) {
                    pending.add(supertype);
                }
            }
        }
        return found;
    }

    private List<String> concat(String superName, List<String> interfaces) {
        List<String> all = new ArrayList<>(interfaces);
        if (superName != null) {
            all.add(superName);
        }
        return all;
    }

    /** The concrete methods a call may land on; the declared target itself if it has a body. */
    private List<MethodKey> implementationsOf(MethodKey call, Map<String, List<String>> implementorsOf) {
        MethodInfo declared = allMethods.get(call);
        if (declared != null && !declared.isAbstract) {
            return List.of(call);
        }
        List<MethodKey> overrides = new ArrayList<>();
        for (String implementor : implementorsOf.getOrDefault(call.owner(), List.of())) {
            MethodKey override = new MethodKey(implementor, call.name(), call.desc());
            MethodInfo info = allMethods.get(override);
            if (info != null && !info.isAbstract) {
                overrides.add(override);
            }
        }
        return overrides.isEmpty() ? List.of(call) : overrides;
    }

    // ── 3. Walk each endpoint's flow ───────────────────────────────────────────

    /** A mapping annotation only exposes a URL from a controller; the other kinds live in any bean. */
    private List<Endpoint> collectEndpoints() {
        List<Endpoint> endpoints = new ArrayList<>();
        for (ClassInfo cls : classes.values()) {
            for (Endpoint endpoint : cls.endpoints) {
                if (cls.isController || !HTTP.equals(endpoint.kind())) {
                    endpoints.add(endpoint);
                }
            }
        }
        return endpoints;
    }

    private Flow walk(Endpoint endpoint, Map<MethodKey, Set<MethodKey>> calls) {
        Map<MethodKey, Integer> depthOf = new LinkedHashMap<>();
        depthOf.put(endpoint.key(), 0);
        Deque<MethodKey> pending = new ArrayDeque<>(List.of(endpoint.key()));
        while (!pending.isEmpty()) {
            MethodKey current = pending.poll();
            for (MethodKey callee : calls.getOrDefault(current, Set.of())) {
                if (!depthOf.containsKey(callee)) {
                    depthOf.put(callee, depthOf.get(current) + 1);
                    pending.add(callee);
                }
            }
        }

        List<Node> nodes = depthOf.keySet().stream().map(this::toNode).toList();
        // A plain sum: straight-line code already scores 0, so nothing has to be subtracted to
        // stop forty Lombok setters outweighing one nested loop.
        Map<String, Integer> cognitiveByLayer = new LinkedHashMap<>();
        for (String layer : LAYERS) {
            int cognitive = nodes.stream()
                    .filter(n -> n.layer().equals(layer))
                    .mapToInt(Node::cognitive).sum();
            if (cognitive > 0) {
                cognitiveByLayer.put(layer, cognitive);
            }
        }
        int total = nodes.stream().mapToInt(Node::cognitive).sum();
        int depth = depthOf.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        return new Flow(endpoint, nodes, total, depth, cognitiveByLayer);
    }

    private Node toNode(MethodKey key) {
        JavaSourceIndex.SourceMethod source = sourceIndex
                .find(key.owner(), key.name(), key.simpleParameterTypes()).orElse(null);
        return new Node(key, source == null ? 0 : source.cognitive(), layerOf(key.owner()), source);
    }

    private static final List<String> LAYERS = List.of("controller", "mapper", "repository", "model", "other");

    private String layerOf(String internalName) {
        String pkg = internalName.substring(0, Math.max(internalName.lastIndexOf('/'), 0));
        if (pkg.endsWith("/mapper")) {
            return "mapper";
        }
        if (pkg.endsWith("/repository")) {
            return "repository";
        }
        if (pkg.endsWith("/domain") || pkg.endsWith("/dto")) {
            return "model";
        }
        if (pkg.endsWith("/rest") || pkg.endsWith("/rest/error")) {
            return "controller";
        }
        return "other";
    }

    // ── 4. Render ──────────────────────────────────────────────────────────────

    /**
     * {@code flowCc} is kept as an alias of {@code flowCognitive} — same number, older name —
     * because the /human-review delta script reads that key to draw the before/after bars.
     */
    private String toJson(List<Flow> flows) {
        StringBuilder sb = new StringBuilder("[\n");
        for (int i = 0; i < flows.size(); i++) {
            Flow f = flows.get(i);
            sb.append("  {\n")
                    .append("    \"kind\": \"").append(f.endpoint().kind()).append("\",\n")
                    .append("    \"httpMethod\": \"").append(f.endpoint().verb()).append("\",\n")
                    .append("    \"path\": \"").append(f.endpoint().label()).append("\",\n")
                    .append("    \"handler\": \"").append(f.endpoint().key().display()).append("\",\n")
                    .append("    \"metric\": \"cognitive\",\n")
                    .append("    \"flowCognitive\": ").append(f.cognitive()).append(",\n")
                    .append("    \"flowCc\": ").append(f.cognitive()).append(",\n")
                    .append("    \"methods\": ").append(f.nodes().size()).append(",\n")
                    .append("    \"depth\": ").append(f.depth()).append(",\n")
                    .append("    \"cognitiveByLayer\": {");
            List<String> parts = new ArrayList<>();
            f.cognitiveByLayer().forEach((layer, cognitive) -> parts.add("\"" + layer + "\": " + cognitive));
            sb.append(String.join(", ", parts)).append("},\n")
                    .append("    \"flow\": [\n");
            List<String> methods = new ArrayList<>();
            for (Node n : f.nodes()) {
                methods.add("      {\"method\": \"" + n.key().owner().replace('/', '.')
                        + "#" + n.key().name() + "\", \"cognitive\": " + n.cognitive()
                        + ", \"layer\": \"" + n.layer() + "\"}");
            }
            sb.append(String.join(",\n", methods)).append("\n    ]\n  }");
            sb.append(i < flows.size() - 1 ? ",\n" : "\n");
        }
        return sb.append("]\n").toString();
    }

    private String toHtml(List<Flow> flows) {
        int max = Math.max(1, flows.stream().mapToInt(Flow::cognitive).max().orElse(1));
        StringBuilder sb = new StringBuilder();
        sb.append(htmlHead("Entry point complexity"));

        sb.append("<p class=\"lede\"><b>Cognitive Complexity</b> (Sonar) of the <em>whole flow</em> behind "
                + "each entry point — REST endpoint, MCP tool, message listener or job: one point per break "
                + "in the linear flow, plus one more for every level of nesting it sits in, summed over every "
                + "method reachable from the handler. Bigger bar = more a reader must hold in their head to "
                + "follow the request; the segments say which layer that weight lives in. "
                + "<a href=\"endpoint-complexity-explained.html\">See where each point comes from →</a></p>\n");

        List<String> usedLayers = LAYERS.stream()
                .filter(layer -> flows.stream().anyMatch(f -> f.cognitiveByLayer().containsKey(layer)))
                .toList();
        sb.append("<div class=\"legend\">");
        for (String layer : usedLayers) {
            sb.append("<span class=\"legend-item\"><i class=\"swatch\" style=\"background:var(--series-")
                    .append(LAYERS.indexOf(layer) + 1).append(")\"></i>").append(layer).append("</span>");
        }
        sb.append("</div>\n");

        for (String kind : KINDS) {
            List<Flow> ofKind = flows.stream().filter(f -> f.endpoint().kind().equals(kind)).toList();
            if (ofKind.isEmpty()) {
                continue;
            }
            sb.append("<h2 class=\"kind\">").append(KIND_TITLES.get(kind)).append("</h2>\n")
                    .append("<div class=\"chart\">\n");
            ofKind.forEach(f -> appendChartRow(sb, f, max));
            sb.append("</div>\n");
        }

        sb.append("<h2>Table view</h2>\n<table class=\"summary\">\n")
                .append("<thead><tr><th>kind</th><th>entry point</th><th>handler</th>"
                        + "<th class=\"num\">cognitive</th><th class=\"num\">methods</th>"
                        + "<th class=\"num\">depth</th></tr></thead>\n<tbody>\n");
        for (Flow f : flows) {
            sb.append("<tr><td>").append(f.endpoint().kind()).append("</td><td><b class=\"verb v-")
                    .append(f.endpoint().verb()).append("\">")
                    .append(f.endpoint().verb()).append("</b> ")
                    .append(escape(f.endpoint().label())).append("</td><td>")
                    .append(escape(f.endpoint().key().display())).append("</td><td class=\"num\">")
                    .append(f.cognitive()).append("</td><td class=\"num\">").append(f.nodes().size())
                    .append("</td><td class=\"num\">").append(f.depth()).append("</td></tr>\n");
        }
        sb.append("</tbody>\n</table>\n");

        sb.append("<p class=\"footer\">Generated by EndpointComplexityExtractorTest: the call graph from "
                + "petclinic-backend/target/classes (ASM), scored on the source in src/main/java and "
                + "target/generated-sources/annotations (JavaParser), because nesting depth — half of the "
                + "metric — does not survive compilation. A call reaching an interface with several "
                + "implementations counts all of them; a method with no source in this repo (a Lombok "
                + "accessor, a Spring Data query generated at runtime) scores 0 and is tagged "
                + "<span class=\"tag\">runtime</span> — there is nothing there to read.</p>\n");
        sb.append(htmlTail());
        return sb.toString();
    }

    private void appendChartRow(StringBuilder sb, Flow f, int max) {
        sb.append("<details class=\"row\">\n<summary>\n")
                .append("<span class=\"endpoint\"><b class=\"verb v-")
                .append(f.endpoint().verb()).append("\">")
                .append(f.endpoint().verb()).append("</b> ")
                .append(escape(f.endpoint().label())).append("</span>\n")
                .append("<span class=\"bar\">");
        if (f.cognitiveByLayer().isEmpty()) {
            sb.append("<i class=\"seg empty\" data-tip=\"Nothing in this flow breaks the linear "
                    + "reading order\"></i>");
        }
        for (Map.Entry<String, Integer> segment : f.cognitiveByLayer().entrySet()) {
            double width = 100.0 * segment.getValue() / max;
            sb.append("<i class=\"seg\" style=\"width:").append(String.format("%.2f", width))
                    .append("%;background:var(--series-").append(LAYERS.indexOf(segment.getKey()) + 1)
                    .append(")\" data-tip=\"").append(segment.getKey()).append(": ")
                    .append(segment.getValue()).append(" cognitive points\"></i>");
        }
        sb.append("</span>\n<span class=\"value\">").append(f.cognitive()).append("</span>\n")
                .append("</summary>\n<div class=\"detail\"><p class=\"meta\">")
                .append(escape(f.endpoint().key().display())).append(" — ")
                .append(f.nodes().size()).append(" methods, call depth ").append(f.depth())
                // only a flow that costs something has a section over there to land on
                .append(f.cognitive() == 0
                        ? ""
                        : " — <a href=\"endpoint-complexity-explained.html#" + anchorOf(f)
                                + "\">explain this score</a>")
                .append("</p>\n<table class=\"flow\">\n")
                .append("<thead><tr><th>method</th><th>layer</th><th class=\"num\">cognitive</th></tr></thead>\n"
                        + "<tbody>\n");
        f.nodes().stream()
                .sorted(Comparator.comparingInt(Node::cognitive).reversed()
                        .thenComparing(n -> n.key().display()))
                .forEach(n -> sb.append("<tr><td>").append(escape(n.key().display()))
                        .append(n.unresolved()
                                ? " <span class=\"tag\" data-tip=\"No source in this repo — a Lombok "
                                        + "accessor, or generated at runtime (Spring Data). Nothing to "
                                        + "read, so it scores 0.\">runtime</span>"
                                : "")
                        .append("</td><td>").append(n.layer())
                        .append("</td><td class=\"num\">").append(n.cognitive()).append("</td></tr>\n"));
        sb.append("</tbody>\n</table>\n</div>\n</details>\n");
    }

    // ── 5. Render the line-by-line explanation of every score ──────────────────

    /**
     * The companion report: for each entry point, every method of its flow that costs anything,
     * shown as its own source with one annotation per increment — what it cost, why, and the
     * running total — so the headline number can be rebuilt by hand from the code itself.
     */
    private String toExplainedHtml(List<Flow> flows) {
        StringBuilder sb = new StringBuilder(htmlHead("Cognitive Complexity, explained"))
                .append("<p class=\"lede\">Where every point of the ")
                .append("<a href=\"endpoint-complexity.html\">entry point complexity</a> score comes from. "
                        + "Cognitive Complexity charges <b>+1</b> for each break in the linear reading order "
                        + "and <b>+1 more per level of nesting</b> it sits in; shorthand a reader takes in at "
                        + "a glance is free — a <code>switch</code> costs 1 however many cases it has, and "
                        + "<code>else</code> costs 1 with no nesting penalty. Add the annotations down the "
                        + "right-hand gutter and you get the number in the header.</p>\n")
                .append(explainedLegend());

        for (String kind : KINDS) {
            List<Flow> ofKind = flows.stream()
                    .filter(f -> f.endpoint().kind().equals(kind) && f.cognitive() > 0).toList();
            if (ofKind.isEmpty()) {
                continue;
            }
            sb.append("<h2 class=\"kind\">").append(KIND_TITLES.get(kind)).append("</h2>\n");
            ofKind.forEach(f -> appendExplainedFlow(sb, f));
        }

        List<Flow> free = flows.stream().filter(f -> f.cognitive() == 0).toList();
        if (!free.isEmpty()) {
            sb.append("<h2>Nothing to explain</h2>\n<p class=\"lede\">")
                    .append(free.size()).append(" entry points score 0: every method in their flow reads "
                            + "top to bottom.</p>\n<ul class=\"free\">\n");
            free.forEach(f -> sb.append("<li><b class=\"verb v-").append(f.endpoint().verb()).append("\">")
                    .append(f.endpoint().verb()).append("</b> ")
                    .append(escape(f.endpoint().label())).append("</li>\n"));
            sb.append("</ul>\n");
        }
        return sb.append(htmlTail()).toString();
    }

    private String explainedLegend() {
        return """
                <div class="legend">
                <span class="legend-item"><i class="chip structural">+1&nbsp;·&nbsp;nesting&nbsp;0</i>\
                a break in the flow, at the top level of the method</span>
                <span class="legend-item"><i class="chip nested">+3&nbsp;·&nbsp;nesting&nbsp;2</i>\
                the same break, two levels deep — 1 + 2</span>
                <span class="legend-item"><i class="chip flat">+1&nbsp;·&nbsp;flat</i>\
                no nesting penalty: else, else if, &amp;&amp;/||, recursion, break to a label</span>
                </div>
                """;
    }

    private void appendExplainedFlow(StringBuilder sb, Flow f) {
        List<Node> scoring = f.nodes().stream()
                .filter(n -> n.cognitive() > 0)
                .sorted(Comparator.comparingInt(Node::cognitive).reversed()
                        .thenComparing(n -> n.key().display()))
                .toList();
        sb.append("<details class=\"explained\" id=\"").append(anchorOf(f)).append("\">\n<summary>\n")
                .append("<span class=\"endpoint\"><b class=\"verb v-").append(f.endpoint().verb())
                .append("\">").append(f.endpoint().verb()).append("</b> ")
                .append(escape(f.endpoint().label())).append("</span>\n")
                .append("<span class=\"breakdown\">")
                .append(scoring.size()).append(scoring.size() == 1 ? " method costs" : " methods cost")
                .append(" something, out of ").append(f.nodes().size()).append(" in the flow</span>\n")
                .append("<span class=\"value\">").append(f.cognitive()).append("</span>\n</summary>\n")
                .append("<div class=\"detail-full\">\n");
        int running = 0;
        for (Node node : scoring) {
            appendExplainedMethod(sb, node, running);
            running += node.cognitive();
        }
        sb.append("<p class=\"meta total\">Total for ")
                .append(escape(f.endpoint().key().display())).append(" = ")
                .append(f.cognitive()).append("</p>\n</div>\n</details>\n");
    }

    private void appendExplainedMethod(StringBuilder sb, Node node, int runningBefore) {
        JavaSourceIndex.SourceMethod source = node.source();
        Map<Integer, List<CognitiveComplexity.Increment>> byLine = new LinkedHashMap<>();
        source.score().increments()
                .forEach(inc -> byLine.computeIfAbsent(inc.line(), k -> new ArrayList<>()).add(inc));

        sb.append("<div class=\"method\">\n<p class=\"method-head\"><span class=\"sig\">")
                .append(escape(node.key().display())).append("</span>")
                .append(source.generated()
                        ? " <span class=\"tag\" data-tip=\"MapStruct output in "
                                + "target/generated-sources/annotations — it runs in this flow, but it is not "
                                + "code anyone maintains by hand.\">generated</span>"
                        : "")
                .append("<span class=\"method-score\">+").append(node.cognitive()).append("</span></p>\n")
                .append("<p class=\"meta\">").append(escape(source.file().toString())).append(":")
                .append(source.firstLine()).append("</p>\n")
                .append("<table class=\"src\">\n<tbody>\n");

        int running = runningBefore;
        for (int offset = 0; offset < source.sourceLines().size(); offset++) {
            int line = source.firstLine() + offset;
            List<CognitiveComplexity.Increment> here = byLine.getOrDefault(line, List.of());
            sb.append("<tr").append(here.isEmpty() ? "" : " class=\"hit\"").append("><td class=\"ln\">")
                    .append(line).append("</td><td class=\"code\">")
                    .append(escape(source.sourceLines().get(offset))).append("</td><td class=\"inc\">");
            for (CognitiveComplexity.Increment increment : here) {
                running += increment.cost();
                sb.append(chip(increment));
            }
            sb.append("</td><td class=\"run\">").append(here.isEmpty() ? "" : String.valueOf(running))
                    .append("</td></tr>\n");
        }
        sb.append("</tbody>\n</table>\n</div>\n");
    }

    private String chip(CognitiveComplexity.Increment increment) {
        String kindClass = NEVER_NESTED.contains(increment.reason())
                ? "flat"
                : increment.nesting() == 0 ? "structural" : "nested";
        String why = increment.nesting() == 0
                ? "+1 for the " + increment.reason()
                : "+1 for the " + increment.reason() + ", +" + increment.nesting() + " for sitting "
                        + increment.nesting() + " level" + (increment.nesting() == 1 ? "" : "s") + " deep";
        return "<i class=\"chip " + kindClass + "\" data-tip=\"" + escape(why) + "\">"
                + escape(increment.reason()) + " +" + increment.cost()
                + (increment.nesting() > 0 ? " · nesting " + increment.nesting() : "") + "</i>";
    }

    /** The increments that never pay a nesting penalty, however deep they sit — rule (c). */
    private static final Set<String> NEVER_NESTED = Set.of(
            "else", "else if", "&&", "||", "recursion", "break to label", "continue to label");

    private static String anchorOf(Flow f) {
        return (f.endpoint().kind() + "-" + f.endpoint().verb() + "-" + f.endpoint().label())
                .replaceAll("[^A-Za-z0-9]+", "-").toLowerCase();
    }

    private String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String htmlHead(String title) {
        return """
                <!doctype html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>""" + title + """
                </title>
                <style>
                """ + resource("report.css") + resource("explained.css") + """
                </style>
                </head>
                <body>
                <main>
                <h1>""" + title + """
                </h1>
                """;
    }

    private static String htmlTail() {
        return """
                </main>
                <div id="tip" role="tooltip"></div>
                <script>
                """ + resource("tooltip.js") + """
                </script>
                </body>
                </html>
                """;
    }

    /** The page is one self-contained file, so its CSS and JS are inlined at generation time. */
    private static String resource(String name) {
        String path = "/endpoint-complexity/" + name;
        try (InputStream in = EndpointComplexityExtractorTest.class.getResourceAsStream(path)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException | NullPointerException e) {
            throw new IllegalStateException("missing test resource " + path, e);
        }
    }

    private static String join(String prefix, String path) {
        String joined = (prefix == null ? "" : prefix) + "/" + (path == null ? "" : path);
        joined = joined.replaceAll("/+", "/");
        if (joined.length() > 1 && joined.endsWith("/")) {
            joined = joined.substring(0, joined.length() - 1);
        }
        return joined.startsWith("/") ? joined : "/" + joined;
    }
}
