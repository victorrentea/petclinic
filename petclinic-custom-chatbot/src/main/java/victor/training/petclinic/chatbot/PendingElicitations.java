package victor.training.petclinic.chatbot;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import io.modelcontextprotocol.spec.McpSchema.ElicitRequest;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * Bridge between a BLOCKING MCP elicitation callback and the browser. When {@code create_visit} on
 * the remote MCP server asks the client for the owner's phone (an MCP ELICITATION), the callback
 * parks here on a {@link CompletableFuture} and blocks. We:
 * <ol>
 *   <li>push an {@link Event} (id + prompt + field name) to the owner's SSE channel so the page can
 *       show a phone input;</li>
 *   <li>resume the blocked callback when the browser POSTs the answer ({@link #submit}), turning it
 *       into an ACCEPT, or DECLINE on timeout / when the owner dismisses it.</li>
 * </ol>
 *
 * <p>Everything is keyed by owner name (the same value used as the chat {@code conversationId}), so
 * one owner can never answer another owner's elicitation.
 *
 * <h3>Owner correlation across threads</h3>
 * The MCP SDK runs the (sync) elicitation handler on its OWN scheduler
 * ({@code Mono.fromCallable(handler).subscribeOn(boundedElastic())}) — an unrelated thread with no
 * link to the chat pipeline — so a ThreadLocal set on the pipeline thread does NOT reach it. Instead
 * {@link Assistant} opens a {@link ChatScope} around the blocking pipeline; that publishes the owner
 * into a single guarded slot the handler reads via {@link #currentOwner()}. The scope is mutually
 * exclusive ({@link #chatSlot}), so concurrent chats serialize while one holds the slot — acceptable
 * for a low-traffic assistant and the only thread-independent way to correlate with a shared client.
 */
@Slf4j
@Component
class PendingElicitations {

  /** The single field name we elicit today. Kept here so the SSE event and the result agree. */
  static final String PHONE_FIELD = "phone";

  /** What the browser needs to render the phone box: which request, what to ask, which field. */
  record Event(String id, String prompt, String field) {
  }

  /** A parked elicitation: who owns it (so only they can answer) and the future the callback blocks on. */
  private record Parked(String owner, CompletableFuture<String> answer) {
  }

  /** Parked elicitations awaiting a browser answer, keyed by request id. */
  private final Map<String, Parked> parked = new ConcurrentHashMap<>();

  /** One multicast SSE channel per owner; the page subscribes to it at load, before any chat. */
  private final Map<String, Sinks.Many<Event>> channels = new ConcurrentHashMap<>();

  /**
   * Serializes chats so only one owner occupies {@link #ownerInChat} at a time. A binary semaphore
   * (not a ReentrantLock) on purpose: under {@code Flux.using} the scope is acquired and released on
   * DIFFERENT reactive threads, and a Semaphore permit — unlike a lock — may be released by any
   * thread.
   */
  private final Semaphore chatSlot = new Semaphore(1);

  /** The owner whose blocking chat is currently running — the elicitation handler reads this. */
  private volatile String ownerInChat;

  /**
   * Opened by {@link Assistant} around the blocking chat pipeline so the elicitation handler (on its
   * own SDK thread) can recover the owner via {@link #currentOwner()}. Closing it releases the slot.
   */
  final class ChatScope implements AutoCloseable {
    private ChatScope(String owner) {
      chatSlot.acquireUninterruptibly();
      ownerInChat = owner;
    }

    @Override
    public void close() {
      ownerInChat = null;
      chatSlot.release();
    }
  }

  /** Begin a chat for {@code owner}; the returned scope MUST be closed (try-with-resources). */
  ChatScope beginChat(String owner) {
    return new ChatScope(owner);
  }

  /** The owner of the chat currently running — used by the elicitation handler to correlate. */
  String currentOwner() {
    return ownerInChat;
  }

  /**
   * Park the elicitation for {@code owner}, notify the browser over SSE, and BLOCK the calling
   * (boundedElastic) thread until the owner submits a value or {@code timeout} elapses. Returns an
   * ACCEPT with the submitted value, or DECLINE if nobody answered in time.
   */
  ElicitResult await(String owner, ElicitRequest request, Duration timeout) {
    String id = UUID.randomUUID().toString();
    CompletableFuture<String> future = new CompletableFuture<>();
    parked.put(id, new Parked(owner, future));
    Event event = new Event(id, request.message(), PHONE_FIELD);
    channel(owner).tryEmitNext(event);
    log.info("⏸️ parked elicitation {} for owner '{}': {}", id, owner, request.message());
    try {
      String value = future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
      log.info("▶️ resuming elicitation {} for owner '{}' with submitted value", id, owner);
      return new ElicitResult(ElicitResult.Action.ACCEPT, Map.of(PHONE_FIELD, value));
    } catch (TimeoutException e) {
      log.warn("⌛ elicitation {} for owner '{}' timed out — declining", id, owner);
      return new ElicitResult(ElicitResult.Action.DECLINE, Map.of());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return new ElicitResult(ElicitResult.Action.CANCEL, Map.of());
    } catch (Exception e) {
      log.warn("elicitation {} for owner '{}' failed: {}", id, owner, e.toString());
      return new ElicitResult(ElicitResult.Action.CANCEL, Map.of());
    } finally {
      parked.remove(id);
    }
  }

  /**
   * Answer a parked elicitation: completes its future so the blocked callback resumes with ACCEPT.
   * The {@code owner} must match the one the elicitation was parked for — so a user can never answer
   * another's. Returns false if no such elicitation is parked for that owner (unknown / already
   * answered / timed out / wrong owner).
   */
  boolean submit(String owner, String id, String value) {
    Parked p = parked.get(id);
    if (p == null || !p.owner().equals(owner)) {
      log.warn("rejecting submit for elicitation {} by owner '{}' (unknown or not theirs)", id, owner);
      return false;
    }
    return p.answer().complete(value);
  }

  /** The owner's SSE stream of elicitation events; the page subscribes to this. */
  Flux<Event> events(String owner) {
    return channel(owner).asFlux();
  }

  private Sinks.Many<Event> channel(String owner) {
    // Multicast (no replay): the page's EventSource is subscribed at load — long before a chat can
    // trigger an elicitation — so live events suffice and we never re-show an already-answered box on
    // a page reload. onBackpressureBuffer holds events for a briefly-reconnecting subscriber.
    return channels.computeIfAbsent(owner, o -> Sinks.many().multicast().onBackpressureBuffer());
  }
}
