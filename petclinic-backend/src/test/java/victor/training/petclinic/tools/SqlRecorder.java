package victor.training.petclinic.tools;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.hibernate.resource.jdbc.spi.StatementInspector;

/** Records every SQL statement Hibernate prepares, so a test can count them. */
public class SqlRecorder implements StatementInspector {
    /** Put in {@code @SpringBootTest(properties = ...)} to activate. */
    public static final String ACTIVATE = "spring.jpa.properties.hibernate.session_factory.statement_inspector="
            + "victor.training.petclinic.tools.SqlRecorder";
    private static final List<String> STATEMENTS = new CopyOnWriteArrayList<>();

    @Override
    public String inspect(String sql) {
        STATEMENTS.add(sql);
        return sql;
    }

    public static void clear() {
        STATEMENTS.clear();
    }

    /** SELECTs only, stripped of the leading comment that hibernate.use_sql_comments adds. */
    public static List<String> selects() {
        return STATEMENTS.stream()
                .map(sql -> sql.replaceFirst("(?s)^\\s*/\\*.*?\\*/\\s*", "").toLowerCase())
                .filter(sql -> sql.startsWith("select"))
                .toList();
    }
}
