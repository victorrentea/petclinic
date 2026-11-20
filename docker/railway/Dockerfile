# The preview environment on Railway: the same backend and SPA as docker-compose.yml, in ONE
# container, so a deploy is a single `railway up` from the repo root (see deploy-preview.yml).
# Two services would need nginx re-pointed at Railway's private DNS; here nginx proxies to
# 127.0.0.1:8080 instead. Postgres is Railway's own service, wired in through the
# SPRING_DATASOURCE_* variables. Notification service, reset sidecar, reaper and the
# collector are left out: the backend treats a missing notification service as a warning.
#
# No `RUN --mount=type=cache` here, unlike the compose Dockerfiles: Railway's builder only
# accepts cache mounts whose id carries the service id, which would tie this file to one
# Railway project.

FROM maven:3.9-eclipse-temurin-21 AS backend
COPY petclinic-commons/pom.xml /commons/pom.xml
COPY petclinic-commons/src /commons/src
RUN mvn -q -B -f /commons/pom.xml install
WORKDIR /app
COPY petclinic-backend/pom.xml .
COPY petclinic-backend/src ./src
RUN mvn -q -B clean package -DskipTests

# Same toolchain as petclinic-frontend/Dockerfile, which explains it.
FROM node:18-bookworm-slim AS frontend
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY petclinic-frontend/package.json petclinic-frontend/package-lock.json ./
RUN npm ci
COPY petclinic-frontend/ .
RUN npx ng build --configuration docker

FROM nginx:1.27-bookworm
COPY --from=eclipse-temurin:21-jre /opt/java/openjdk /opt/java/openjdk
ENV PATH=/opt/java/openjdk/bin:$PATH
COPY --from=backend /app/target/*.jar /app/app.jar
COPY --from=frontend /app/dist/ /usr/share/nginx/html/
# The compose nginx config, unchanged except where the backend lives: the same container.
COPY petclinic-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY petclinic-frontend/proxy-backend.conf /etc/nginx/proxy-backend.conf
RUN sed -i 's/^set \$upstream backend;$/set $upstream 127.0.0.1;/' /etc/nginx/proxy-backend.conf \
    && grep -q 'set $upstream 127.0.0.1;' /etc/nginx/proxy-backend.conf \
    && mkdir -p /activity
COPY docker/railway/start.sh /start.sh

EXPOSE 4200
CMD ["bash", "/start.sh"]
