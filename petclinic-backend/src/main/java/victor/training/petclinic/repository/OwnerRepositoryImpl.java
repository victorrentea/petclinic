package victor.training.petclinic.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import victor.training.petclinic.domain.Owner;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * Hand-written HQL instead of a derived query: the JPA Criteria API has no {@code NULLS LAST}
 * support, and emulating it with a leading {@code CASE WHEN column IS NULL} rank makes the first
 * ORDER BY key an expression, which stops {@code idx_owners_last_name_first_name_id} from ever
 * being used (measured: seq scan + top-N heapsort over the whole table). HQL emits a real
 * {@code nulls last}, which on Postgres is already the default for ascending order, so the default
 * {@code name,asc} page is served straight from the index.
 */
@Repository
public class OwnerRepositoryImpl implements OwnerRepositoryCustom {

    /**
     * Defence in depth: the ORDER BY clause is string-concatenated, so every property is re-checked
     * here even though {@code OwnerSortResolver} already allowlists the UI-facing sort keys.
     */
    private static final Set<String> SORTABLE_PROPERTIES = Set.of("lastName", "firstName", "city", "id");

    /** {@code id} is the NOT NULL primary key — a {@code nulls last} hint on it is dead weight. */
    private static final Set<String> NON_NULLABLE_SORT_PROPERTIES = Set.of("id");

    private static final String LIKE_ESCAPE = "\\";

    private static final String FILTER_BY_LAST_NAME = " from Owner o where o.lastName like :prefix escape :esc";

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable) {
        String prefixPattern = escapeLikeWildcards(lastName) + "%";

        List<Owner> content = entityManager.createQuery(
                "select o" + FILTER_BY_LAST_NAME + " order by " + toOrderByClause(pageable.getSort()),
                Owner.class)
                .setParameter("prefix", prefixPattern)
                .setParameter("esc", LIKE_ESCAPE.charAt(0))
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList();

        long total = entityManager.createQuery("select count(o)" + FILTER_BY_LAST_NAME, Long.class)
                .setParameter("prefix", prefixPattern)
                .setParameter("esc", LIKE_ESCAPE.charAt(0))
                .getSingleResult();

        return new PageImpl<>(content, pageable, total);
    }

    /**
     * Keeps the filter a prefix match: without this, {@code ?lastName=%} matches every owner and
     * forces a full scan on both the content and the count query. Mirrors what Spring Data's
     * {@code EscapeCharacter.DEFAULT} did for the derived query this replaced.
     */
    private String escapeLikeWildcards(String value) {
        return value.replace(LIKE_ESCAPE, LIKE_ESCAPE + LIKE_ESCAPE)
                .replace("%", LIKE_ESCAPE + "%")
                .replace("_", LIKE_ESCAPE + "_");
    }

    private String toOrderByClause(Sort sort) {
        List<String> terms = new ArrayList<>();
        for (Sort.Order order : sort) {
            String property = order.getProperty();
            if (!SORTABLE_PROPERTIES.contains(property)) {
                throw new IllegalArgumentException("Unsortable owner property: " + property);
            }
            String nullHandling = NON_NULLABLE_SORT_PROPERTIES.contains(property) ? "" : " nulls last";
            terms.add("o." + property + (order.isAscending() ? " asc" : " desc") + nullHandling);
        }
        if (terms.isEmpty()) {
            terms.add("o.id asc");
        }
        return String.join(", ", terms);
    }
}
