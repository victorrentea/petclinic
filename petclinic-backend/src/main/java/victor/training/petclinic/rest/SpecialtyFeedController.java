package victor.training.petclinic.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Snapshot of all specialties for polling clients (e.g. a RAG sync job), with an ETag so an unchanged
 * poll returns 304 Not Modified and no body. Deliberately NOT under the VET_ADMIN-guarded
 * {@link SpecialtyRestController}: this is a read-only public feed any internal client may poll without
 * a user token. The backing list is cached ({@link SpecialtyFeed}), so frequent polling never reaches
 * the database.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SpecialtyFeedController {
    private final SpecialtyFeed specialtyFeed;

    @GetMapping("/specialties/feed")
    public ResponseEntity<List<SpecialtyFeed.Item>> feed(
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        List<SpecialtyFeed.Item> items = specialtyFeed.load();
        String etag = specialtyFeed.etag(items);
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(304).eTag(etag).build();
        }
        return ResponseEntity.ok().eTag(etag).body(items);
    }
}
