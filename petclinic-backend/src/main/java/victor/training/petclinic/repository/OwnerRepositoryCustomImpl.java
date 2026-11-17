package victor.training.petclinic.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;

public class OwnerRepositoryCustomImpl implements OwnerRepositoryCustom {
    private static final String PREFIX_PREDICATE = "last_name LIKE :prefix ESCAPE '\\'";

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @SuppressWarnings("unchecked")
    public List<Integer> findIdsPage(String lastNamePrefix, OwnerSort sort, int size, long offset) {
        String sql = "SELECT id FROM owners WHERE " + PREFIX_PREDICATE
                + " ORDER BY " + sort.orderBy() + " LIMIT :size OFFSET :offset";
        return entityManager.createNativeQuery(sql, Integer.class)
                .setParameter("prefix", likePattern(lastNamePrefix))
                .setParameter("size", size)
                .setParameter("offset", offset)
                .getResultList();
    }

    @Override
    public long countByLastNamePrefix(String lastNamePrefix) {
        return ((Number) entityManager
                .createNativeQuery("SELECT count(*) FROM owners WHERE " + PREFIX_PREDICATE)
                .setParameter("prefix", likePattern(lastNamePrefix))
                .getSingleResult()).longValue();
    }

    private static String likePattern(String literalPrefix) {
        return literalPrefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
