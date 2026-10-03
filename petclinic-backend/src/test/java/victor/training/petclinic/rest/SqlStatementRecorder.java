package victor.training.petclinic.rest;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.hibernate.resource.jdbc.spi.StatementInspector;

/** Records every SQL statement Hibernate prepares; Hibernate instantiates it by class name, hence the static state. */
public class SqlStatementRecorder implements StatementInspector {
    private static final List<String> statements = new CopyOnWriteArrayList<>();

    @Override
    public String inspect(String sql) {
        statements.add(sql);
        return sql;
    }

    public static void reset() {
        statements.clear();
    }

    public static List<String> selects() {
        return statements.stream()
                .map(SqlStatementRecorder::withoutLeadingComment)
                .filter(sql -> sql.regionMatches(true, 0, "select", 0, 6))
                .toList();
    }

    // use_sql_comments=true prefixes each statement with /* what produced it */
    private static String withoutLeadingComment(String sql) {
        String trimmed = sql.strip();
        return trimmed.startsWith("/*") ? trimmed.substring(trimmed.indexOf("*/") + 2).strip() : trimmed;
    }
}
