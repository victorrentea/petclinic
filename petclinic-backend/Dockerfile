FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app
COPY pom.xml .
COPY src ./src
# A cache mount keeps ~/.m2 across builds, so editing a source file re-resolves nothing.
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn -q -B clean package -DskipTests

FROM eclipse-temurin:21-jre

# The JRE image ships no HTTP client, so the compose healthcheck had nothing to call.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# /actuator/health is exposed by Spring Boot's defaults and left unauthenticated by
# petclinic.security.enable=false, so it needs no extra configuration to be probed.
HEALTHCHECK --interval=5s --timeout=3s --retries=60 --start-period=20s \
    CMD curl -fsS http://127.0.0.1:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
