#!/usr/bin/env python3
"""Put the demo database back to the state Flyway left it in.

This is deliberately *not* part of the backend, and that is the whole design. A reset
endpoint that ships inside the application is one misconfigured profile away from being
reachable in production — @Profile, @ConditionalOnProperty and friends all fail open if
somebody sets the wrong value. This one cannot leak, because it is not in the artefact:
no Java, no Spring bean, nothing in petclinic-backend at all. It is a separate image that
exists only in docker/docker-compose.yml, is never published to a host port, and is
reachable only over the compose network through a route that lives in the nginx config
baked into the container image — a route the dev server has never heard of.

TRUNCATE, not DROP SCHEMA: truncating leaves relation OIDs alone, so the backend's pooled
connections keep their cached prepared-statement plans and the app does not need bouncing.
Dropping the schema invalidates those plans and poisons every pooled connection until
Hikari retires it, up to half an hour later.
"""
import http.server
import json
import os
import subprocess
import sys
import threading

SEED = "/seed/seed-data.sql"
PSQL = ["psql", "-v", "ON_ERROR_STOP=1", "-q"]

# Every table in public, whatever the schema happens to be by then — a hand-kept list
# would silently stop covering a table the next migration adds.
TRUNCATE = """
DO $$
DECLARE stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE '
      || string_agg(format('%I.%I', schemaname, tablename), ', ')
      || ' RESTART IDENTITY CASCADE'
  INTO stmt
  FROM pg_tables WHERE schemaname = 'public';
  IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
END $$;
"""

_lock = threading.Lock()


def _run(args):
    return subprocess.run(args, capture_output=True, text=True)


def capture_seed():
    """The seed, taken once, before anything can have dirtied it.

    At startup rather than on first use: compose holds this container until the backend is
    healthy, which means Flyway has finished, and it means the dump cannot accidentally
    record a database a reviewer has already typed into."""
    if os.path.exists(SEED) and os.path.getsize(SEED) > 0:
        return
    part = SEED + ".part"
    # --disable-triggers: a data-only restore inserts tables in dump order, which is not
    # foreign-key order, so referential checks have to be off while it runs.
    r = _run(["pg_dump", "--data-only", "--disable-triggers", "-f", part])
    if r.returncode != 0:
        raise RuntimeError("pg_dump failed: " + r.stderr.strip())
    # Atomic: a half-written dump that `os.path.getsize` would accept must never become
    # the permanent seed.
    os.replace(part, SEED)


def do_reset():
    with _lock:
        for args in (PSQL + ["-c", TRUNCATE], PSQL + ["-f", SEED]):
            r = _run(args)
            if r.returncode != 0:
                raise RuntimeError(r.stderr.strip())


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            do_reset()
            self._send(200, {"ok": True})
        except Exception as e:            # noqa: BLE001 - the message is the whole point
            self._send(500, {"ok": False, "error": str(e)})

    def do_GET(self):
        self._send(200, {"ok": True, "seeded": os.path.exists(SEED)})

    def log_message(self, fmt, *args):
        sys.stderr.write("reset: " + fmt % args + "\n")


if __name__ == "__main__":
    capture_seed()
    print("reset: seed captured, listening on 8081", file=sys.stderr, flush=True)
    http.server.ThreadingHTTPServer(("", 8081), Handler).serve_forever()
