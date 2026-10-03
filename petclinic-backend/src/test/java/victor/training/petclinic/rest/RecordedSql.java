package victor.training.petclinic.rest;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.hibernate.resource.jdbc.spi.StatementInspector;

/** Records every SQL statement Hibernate sends, once plugged in via {@code hibernate.session_factory.statement_inspector}. */
public class RecordedSql implements StatementInspector {
    private static final List<String> statements = new CopyOnWriteArrayList<>();

    @Override
    public String inspect(String sql) {
        statements.add(withoutLeadingComment(sql));
        return sql;
    }

    public static void clear() {
        statements.clear();
    }

    public static List<String> selects() {
        return statements.stream().filter(sql -> sql.regionMatches(true, 0, "select", 0, 6)).toList();
    }

    // hibernate.use_sql_comments prefixes the HQL as a /* comment */
    private static String withoutLeadingComment(String sql) {
        return sql.replaceFirst("^\\s*/\\*.*?\\*/\\s*", "");
    }
}
