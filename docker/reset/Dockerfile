# Plain alpine, not postgres:16-alpine. The postgres image declares
# VOLUME /var/lib/postgresql/data, and this container mounts nothing there — so every
# instance left an anonymous volume behind, which is how a laptop ends up with ninety of
# them and a Docker daemon that has run out of disk. It only ever needed the client tools.
FROM alpine:3.20

RUN apk add --no-cache postgresql16-client python3

COPY reset-server.py /reset-server.py

# Docker copies ownership from the image's directory when it first populates an empty
# named volume. Without this, /seed arrives root-owned and the unprivileged process
# cannot write the dump into it.
RUN adduser -D reset && mkdir -p /seed && chown reset:reset /seed

EXPOSE 8081

USER reset

HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
    CMD wget -qO- http://127.0.0.1:8081/ || exit 1

ENTRYPOINT ["python3", "/reset-server.py"]
