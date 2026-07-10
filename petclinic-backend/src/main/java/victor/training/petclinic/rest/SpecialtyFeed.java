package victor.training.petclinic.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Specialty;
import victor.training.petclinic.repository.SpecialtyRepository;

import java.util.List;

/**
 * Cached read-model behind {@code GET /api/specialties/feed}. Polling clients hit this every few
 * seconds; {@link #load()} is {@link Cacheable} so the DB is queried ONCE and only re-queried after a
 * real change (any specialty mutation calls {@link #invalidate()}). That keeps the per-poll request off
 * the database — and out of the SQL log. The endpoint adds an ETag on top so unchanged polls get a 304.
 */
@Component
@RequiredArgsConstructor
public class SpecialtyFeed {
    private final SpecialtyRepository specialtyRepository;

    /** Lean projection — exactly what a RAG/sync client needs, decoupled from {@code SpecialtyDto}. */
    public record Item(Integer id, String name, String description) {}

    @Cacheable("specialtyFeed")
    public List<Item> load() {
        return specialtyRepository.findAll().stream()
            .map(this::toItem)
            .toList();
    }

    @CacheEvict(value = "specialtyFeed", allEntries = true)
    public void invalidate() {
        // cache eviction only — emptied so the next load() rebuilds from the DB
    }

    /** Strong validator: same content -> same tag, so a poller's If-None-Match yields a 304. */
    public String etag(List<Item> items) {
        return "\"" + Integer.toHexString(items.hashCode()) + "\"";
    }

    private Item toItem(Specialty s) {
        return new Item(s.getId(), s.getName(), s.getDescription());
    }
}
