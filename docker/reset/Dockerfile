# postgres:16-alpine for psql and pg_dump only — this container never runs a server.
FROM postgres:16-alpine

RUN apk add --no-cache python3

COPY reset-server.py /reset-server.py

# Docker copies ownership from the image's directory when it first populates an empty
# named volume. Without this, /seed arrives root-owned and the unprivileged process
# cannot write the dump into it.
RUN mkdir -p /seed && chown postgres:postgres /seed

EXPOSE 8081

# Not root: it needs a libpq client and nothing else.
USER postgres

HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
    CMD wget -qO- http://127.0.0.1:8081/ || exit 1

ENTRYPOINT ["python3", "/reset-server.py"]
