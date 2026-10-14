#!/usr/bin/env python3
"""Put the demo database back to the state Flyway left it in — or to a named fixture.

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

A fixture is a *.sql file baked into /fixtures from petclinic-backend's db/fixtures, next to
the seed. It is a dataset of its own, not a delta on the seed: POST /<name> truncates and
runs <name>.sql on the empty tables, in one transaction — so a fixture that fails leaves the
database exactly as it was, not half-emptied. POST / restores the seed instead. GET / lists
the fixtures, and the review page draws one button each.
"""
import http.server
import json
import os
import re
import subprocess
import sys
import threading

SEED = "/seed/seed-data.sql"
FIXTURES = "/fixtures"
# On the seed volume, so the page can still say which state it last reset to after this
# container restarts. "Last reset to", not "is in": a reviewer may have typed since.
CURRENT = "/seed/current"
# The name in the URL only ever selects among the files listed; it is never joined into a
# path unchecked. The pattern keeps even the listing free of names a URL cannot carry.
NAME = re.compile(r"[a-z0-9][a-z0-9-]*")
PSQL = ["psql", "-v", "ON_ERROR_STOP=1", "-q"]

# Every table in public, whatever the schema happens to be by then — a hand-kept list
# would silently stop covering a table the next migration adds. `{keep}` spares tables
# by name.
_TRUNCATE = """
DO $$
DECLARE stmt text;
BEGIN
    SELECT 'TRUNCATE TABLE '
        || string_agg(format('%I.%I', schemaname, tablename), ', ')
        || ' RESTART IDENTITY CASCADE'
    INTO stmt
    FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ({keep});
    IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
END $$;
"""
# Before the seed: everything, Flyway's history included — the dump puts it back.
TRUNCATE = _TRUNCATE.format(keep="''")
# Before a fixture: everything but Flyway's history. A fixture is hand-written and does not
# carry the history, and a backend that boots onto an empty history over a full schema
# refuses to start.
TRUNCATE_DATA = _TRUNCATE.format(keep="'flyway_schema_history'")

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


def fixtures():
    try:
        names = os.listdir(FIXTURES)
    except FileNotFoundError:
        return []
    return sorted(n[:-4] for n in names if n.endswith(".sql") and NAME.fullmatch(n[:-4]))


def current():
    try:
        with open(CURRENT) as f:
            return f.read().strip() or "seed"
    except FileNotFoundError:
        return "seed"


def do_reset(fixture=None):
    # A fixture starts from the empty tables, never from the seed: what it shows is only
    # what its own file writes. RESTART IDENTITY in TRUNCATE puts every id back at 1.
    if fixture:
        args = ["-c", TRUNCATE_DATA, "-f", os.path.join(FIXTURES, fixture + ".sql")]
    else:
        args = ["-c", TRUNCATE, "-f", SEED]
    args = PSQL + ["--single-transaction"] + args
    with _lock:
        r = _run(args)
        if r.returncode != 0:
            raise RuntimeError(r.stderr.strip())
        with open(CURRENT, "w") as f:
            f.write(fixture or "seed")


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
        name = self.path.split("?")[0].strip("/")
        if name and name not in fixtures():
            self._send(404, {"ok": False, "error": "no such fixture: " + name,
                    "fixtures": fixtures()})
            return
        try:
            do_reset(name or None)
            self._send(200, {"ok": True, "current": name or "seed"})
        except Exception as e:            # noqa: BLE001 - the message is the whole point
            self._send(500, {"ok": False, "error": str(e)})

    def do_GET(self):
        self._send(200, {"ok": True, "seeded": os.path.exists(SEED),
                "fixtures": fixtures(), "current": current()})

    def log_message(self, fmt, *args):
        sys.stderr.write("reset: " + fmt % args + "\n")


if __name__ == "__main__":
    capture_seed()
    print("reset: seed captured, listening on 8081", file=sys.stderr, flush=True)
    http.server.ThreadingHTTPServer(("", 8081), Handler).serve_forever()
