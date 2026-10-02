package victor.training.petclinic.tools;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import org.hibernate.resource.jdbc.spi.StatementInspector;

/**
 * Records every SQL SELECT Hibernate sends, so a test can put a budget on a request.
 * Register with {@code spring.jpa.properties.hibernate.session_factory.statement_inspector}.
 */
public class SelectRecorder implements StatementInspector {
    private static final Pattern LEADING_COMMENTS = Pattern.compile("^(\\s*/\\*.*?\\*/)*\\s*", Pattern.DOTALL);
    private static final List<String> selects = new CopyOnWriteArrayList<>();

    @Override
    public String inspect(String sql) {
        String statement = LEADING_COMMENTS.matcher(sql).replaceFirst("");
        if (statement.regionMatches(true, 0, "select", 0, 6)) {
            selects.add(statement);
        }
        return sql;
    }

    public static void reset() {
        selects.clear();
    }

    public static List<String> selects() {
        return List.copyOf(selects);
    }
}
