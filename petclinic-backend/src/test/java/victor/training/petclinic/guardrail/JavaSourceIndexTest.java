package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The join between the two readers: ASM names a compiled method, this must hand back the
 * source it was compiled from. If this silently stops matching, every score quietly falls to 0
 * — hence the assertions on real methods of this app rather than on a fixture.
 */
class JavaSourceIndexTest {

    private static final List<Path> ROOTS = List.of(
            Paths.get("src/main/java"), Paths.get("target/generated-sources/annotations"));

    private final JavaSourceIndex index = new JavaSourceIndex(ROOTS);

    @Test
    void findsAHandWrittenMethodAndScoresItFromItsSource() {
        JavaSourceIndex.SourceMethod method = index.find("victor/training/petclinic/mcp/PetClinicMcp",
                "createVisit", List.of("int", "LocalDate", "LocalTime", "String")).orElseThrow();

        assertThat(method.generated()).isFalse();
        assertThat(method.file().toString()).endsWith("mcp/PetClinicMcp.java");
        assertThat(method.sourceLines().get(0)).contains("createVisit");
        // if (owner == null || wrong owner) -> 2, if (time in the past) -> 1
        assertThat(method.cognitive()).isEqualTo(3);
        assertThat(method.score().increments()).extracting(CognitiveComplexity.Increment::reason)
                .containsExactly("if", "||", "if");
    }

    @Test
    void findsMapStructOutputAndFlagsItAsGenerated() {
        JavaSourceIndex.SourceMethod method = index.find("victor/training/petclinic/mapper/OwnerMapperImpl",
                "toOwnerDto", List.of("Owner")).orElseThrow();

        assertThat(method.generated()).isTrue();
        assertThat(method.cognitive()).isEqualTo(1); // the null guard MapStruct opens every mapping with
    }

    @Test
    void reportsNothingForAMethodThisRepoHasNoSourceFor() {
        // Lombok writes the accessors straight into the bytecode; there is no source to read
        assertThat(index.find("victor/training/petclinic/domain/Owner", "getFirstName", List.of())).isEmpty();
    }

    @Test
    void matchesTheSourceLinesToTheDeclarationNotToTheAnnotationsAboveIt() {
        JavaSourceIndex.SourceMethod method = index.find("victor/training/petclinic/mcp/PetClinicMcp",
                "createVisit", List.of("int", "LocalDate", "LocalTime", "String")).orElseThrow();

        assertThat(method.sourceLines()).as("the @McpTool block above the signature is context, not code")
                .noneMatch(line -> line.trim().startsWith("@McpTool("));
        assertThat(method.sourceLines()).last().asString().isEqualTo("    }");
    }
}
