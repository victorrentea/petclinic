package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;
import org.objectweb.asm.AnnotationVisitor;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.Handle;
import org.objectweb.asm.Label;
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
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Generates docs/generated/endpoint-complexity.{html,json}: the cyclomatic complexity of the
 * WHOLE FLOW behind every entry point of the app, not just of the annotated method.
 *
 * <p>Everything is read from the compiled bytecode in target/classes with ASM, in one pass:
 * <ul>
 *   <li><b>CC per method</b> = 1 + conditional jumps + switch cases + catch handlers. Bytecode
 *       keeps one jump per {@code &&}/{@code ||}/ternary, so this matches the source-level
 *       McCabe number — while also covering generated and synthetic code that has no source
 *       here, which is exactly the complexity a source parser would miss.</li>
 *   <li><b>Call graph</b> = every {@code invoke*} whose owner is our own package, plus the
 *       lambda bodies referenced by {@code invokedynamic}. A call landing on an abstract or
 *       interface method is re-pointed at the implementations found in target/classes; when
 *       there is none (Spring Data repositories are proxies generated at runtime) the method
 *       stays as a leaf and counts 1 — a query is not free.</li>
 *   <li><b>Entry points</b> = every way the outside world gets into the app: @GetMapping /
 *       @PostMapping / ... in a @RestController (with the class-level @RequestMapping as path
 *       prefix), @McpTool tools, @KafkaListener / @RabbitListener / @JmsListener consumers and
 *       @Scheduled jobs. Each is tagged with its {@code kind} in the emitted JSON.</li>
 * </ul>
 *
 * <p>The headline number, {@code flowCc}, aggregates the way McCabe composes: it is
 * {@code 1 + sum(CC - 1)} over the DISTINCT methods reachable from the handler (cycles counted
 * once) — the decision points of the entire flow, plus one. Summing raw CC instead would count
 * methods rather than paths, and the accessors of a wide DTO would then outweigh every
 * real branch in the code. The number of reachable methods is reported separately, as size.
 *
 * <p>Known limits: only static targets are known, so a call through an interface with several
 * implementations counts them ALL; runtime-generated code (Spring Data, proxies, AOP) is
 * invisible beyond its leaf; reflection is invisible.
 */
class EndpointComplexityExtractorTest {

    private static final String BASE_PKG = "victor/training/petclinic";
    private static final Path CLASSES_DIR = Paths.get("target/classes");
    private static final Path GENERATED_DIR = Paths.get("docs/generated");

    // ── Model ──────────────────────────────────────────────────────────────────

    /** owner is an internal name (victor/training/petclinic/rest/VisitRestController). */
    private record MethodKey(String owner, String name, String desc) {
        String simpleClass() {
            return owner.substring(owner.lastIndexOf('/') + 1).replace('$', '.');
        }

        String display() {
            return simpleClass() + "." + name + argumentList();
        }

        private String argumentList() {
            List<String> args = new ArrayList<>();
            for (Type t : Type.getArgumentTypes(desc)) {
                String name = t.getClassName();
                args.add(name.substring(name.lastIndexOf('.') + 1));
            }
            return "(" + String.join(", ", args) + ")";
        }
    }

    private static class MethodInfo {
        int cc = 1;
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

    /** One method as it appears inside one endpoint's flow. */
    private record Node(MethodKey key, int cc, String layer, boolean unresolved) {
    }

    private record Flow(Endpoint endpoint, List<Node> nodes, int flowCc, int depth,
            Map<String, Integer> decisionsByLayer) {
    }

    private final Map<String, ClassInfo> classes = new LinkedHashMap<>();
    private final Map<MethodKey, MethodInfo> allMethods = new HashMap<>();

    @Test
    void generateEndpointComplexityReport() throws IOException {
        scanCompiledClasses();
        assertThat(classes).as("no classes found in %s — run through Maven so main is compiled",
                CLASSES_DIR.toAbsolutePath()).isNotEmpty();

        Map<MethodKey, Set<MethodKey>> resolvedCalls = resolveVirtualCalls();

        List<Flow> flows = collectEndpoints().stream()
                .map(endpoint -> walk(endpoint, resolvedCalls))
                .sorted(Comparator.comparingInt(Flow::flowCc).reversed()
                        .thenComparing(f -> f.endpoint().label()))
                .toList();

        assertThat(flows).as("no entry point found").isNotEmpty();

        Files.createDirectories(GENERATED_DIR);
        Files.writeString(GENERATED_DIR.resolve("endpoint-complexity.json"), toJson(flows));
        Files.writeString(GENERATED_DIR.resolve("endpoint-complexity.html"), toHtml(flows));

        assertThat(GENERATED_DIR.resolve("endpoint-complexity.html")).exists();
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
        public void visitJumpInsn(int opcode, Label label) {
            if (opcode != Opcodes.GOTO && opcode != Opcodes.JSR) {
                method.cc++;
            }
        }

        @Override
        public void visitTableSwitchInsn(int min, int max, Label dflt, Label... labels) {
            method.cc += labels.length;
        }

        @Override
        public void visitLookupSwitchInsn(Label dflt, int[] keys, Label[] labels) {
            method.cc += labels.length;
        }

        @Override
        public void visitTryCatchBlock(Label start, Label end, Label handler, String type) {
            if (type != null) {
                method.cc++; // a catch clause is a path; a finally (type == null) is not
            }
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
        // McCabe composes over a call flow by DECISION POINTS: a straight-line method (CC 1)
        // adds no path, so summing raw CC would just count methods — and the accessors
        // of a wide DTO would then outweigh every branch in the code.
        Map<String, Integer> decisionsByLayer = new LinkedHashMap<>();
        for (String layer : LAYERS) {
            int decisions = nodes.stream()
                    .filter(n -> n.layer().equals(layer))
                    .mapToInt(n -> n.cc() - 1).sum();
            if (decisions > 0) {
                decisionsByLayer.put(layer, decisions);
            }
        }
        int flowCc = 1 + nodes.stream().mapToInt(n -> n.cc() - 1).sum();
        int depth = depthOf.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        return new Flow(endpoint, nodes, flowCc, depth, decisionsByLayer);
    }

    private Node toNode(MethodKey key) {
        MethodInfo info = allMethods.get(key);
        boolean unresolved = info == null || info.isAbstract;
        int cc = unresolved ? 1 : info.cc; // an unimplemented call (a JPA query) still costs 1
        return new Node(key, cc, layerOf(key.owner()), unresolved);
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

    private String toJson(List<Flow> flows) {
        StringBuilder sb = new StringBuilder("[\n");
        for (int i = 0; i < flows.size(); i++) {
            Flow f = flows.get(i);
            sb.append("  {\n")
                    .append("    \"kind\": \"").append(f.endpoint().kind()).append("\",\n")
                    .append("    \"httpMethod\": \"").append(f.endpoint().verb()).append("\",\n")
                    .append("    \"path\": \"").append(f.endpoint().label()).append("\",\n")
                    .append("    \"handler\": \"").append(f.endpoint().key().display()).append("\",\n")
                    .append("    \"flowCc\": ").append(f.flowCc()).append(",\n")
                    .append("    \"methods\": ").append(f.nodes().size()).append(",\n")
                    .append("    \"depth\": ").append(f.depth()).append(",\n")
                    .append("    \"decisionsByLayer\": {");
            List<String> parts = new ArrayList<>();
            f.decisionsByLayer().forEach((layer, cc) -> parts.add("\"" + layer + "\": " + cc));
            sb.append(String.join(", ", parts)).append("},\n")
                    .append("    \"flow\": [\n");
            List<String> methods = new ArrayList<>();
            for (Node n : f.nodes()) {
                methods.add("      {\"method\": \"" + n.key().owner().replace('/', '.')
                        + "#" + n.key().name() + "\", \"cc\": " + n.cc()
                        + ", \"layer\": \"" + n.layer() + "\"}");
            }
            sb.append(String.join(",\n", methods)).append("\n    ]\n  }");
            sb.append(i < flows.size() - 1 ? ",\n" : "\n");
        }
        return sb.append("]\n").toString();
    }

    private String toHtml(List<Flow> flows) {
        int max = Math.max(1, flows.stream().mapToInt(f -> f.flowCc() - 1).max().orElse(1));
        StringBuilder sb = new StringBuilder();
        sb.append(htmlHead());

        sb.append("<p class=\"lede\">Cyclomatic complexity of the <em>whole flow</em> behind each entry "
                + "point — REST endpoint, MCP tool, message listener or job — read from compiled "
                + "bytecode: every decision point in every method reachable from the handler, plus one. "
                + "Bigger bar = more independent paths between the caller and the database; the segments "
                + "say which layer they live in.</p>\n");

        List<String> usedLayers = LAYERS.stream()
                .filter(layer -> flows.stream().anyMatch(f -> f.decisionsByLayer().containsKey(layer)))
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
                        + "<th class=\"num\">flow CC</th><th class=\"num\">methods</th>"
                        + "<th class=\"num\">depth</th></tr></thead>\n<tbody>\n");
        for (Flow f : flows) {
            sb.append("<tr><td>").append(f.endpoint().kind()).append("</td><td><b class=\"verb v-")
                    .append(f.endpoint().verb()).append("\">")
                    .append(f.endpoint().verb()).append("</b> ")
                    .append(escape(f.endpoint().label())).append("</td><td>")
                    .append(escape(f.endpoint().key().display())).append("</td><td class=\"num\">")
                    .append(f.flowCc()).append("</td><td class=\"num\">").append(f.nodes().size())
                    .append("</td><td class=\"num\">").append(f.depth()).append("</td></tr>\n");
        }
        sb.append("</tbody>\n</table>\n");

        sb.append("<p class=\"footer\">Generated from petclinic-backend/target/classes by "
                + "EndpointComplexityExtractorTest. A call reaching an interface with several "
                + "implementations counts all of them; runtime-generated code (Spring Data queries, "
                + "proxies) counts as 1 and is tagged <span class=\"tag\">runtime</span>.</p>\n");
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
        if (f.decisionsByLayer().isEmpty()) {
            sb.append("<i class=\"seg empty\" data-tip=\"No branching anywhere in this flow\"></i>");
        }
        for (Map.Entry<String, Integer> segment : f.decisionsByLayer().entrySet()) {
            double width = 100.0 * segment.getValue() / max;
            sb.append("<i class=\"seg\" style=\"width:").append(String.format("%.2f", width))
                    .append("%;background:var(--series-").append(LAYERS.indexOf(segment.getKey()) + 1)
                    .append(")\" data-tip=\"").append(segment.getKey()).append(": ")
                    .append(segment.getValue()).append(" decision points\"></i>");
        }
        sb.append("</span>\n<span class=\"value\">").append(f.flowCc()).append("</span>\n")
                .append("</summary>\n<div class=\"detail\"><p class=\"meta\">")
                .append(escape(f.endpoint().key().display())).append(" — ")
                .append(f.nodes().size()).append(" methods, call depth ").append(f.depth())
                .append("</p>\n<table class=\"flow\">\n")
                .append("<thead><tr><th>method</th><th>layer</th><th class=\"num\">CC</th></tr></thead>\n"
                        + "<tbody>\n");
        f.nodes().stream()
                .sorted(Comparator.comparingInt(Node::cc).reversed()
                        .thenComparing(n -> n.key().display()))
                .forEach(n -> sb.append("<tr><td>").append(escape(n.key().display()))
                        .append(n.unresolved()
                                ? " <span class=\"tag\" data-tip=\"No implementation in "
                                        + "target/classes — generated at runtime (Spring Data) or external. "
                                        + "Counted as 1.\">runtime</span>"
                                : "")
                        .append("</td><td>").append(n.layer())
                        .append("</td><td class=\"num\">").append(n.cc()).append("</td></tr>\n"));
        sb.append("</tbody>\n</table>\n</div>\n</details>\n");
    }

    private String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String htmlHead() {
        return """
                <!doctype html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Entry Point Complexity</title>
                <style>
                """ + resource("report.css") + """
                </style>
                </head>
                <body>
                <main>
                <h1>Entry point complexity</h1>
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
