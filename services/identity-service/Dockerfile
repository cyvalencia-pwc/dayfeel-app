FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q package
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system dayfeel && useradd --system --gid dayfeel dayfeel
COPY --from=build --chown=dayfeel:dayfeel /workspace/target/identity-service-0.1.0-SNAPSHOT.jar /app/app.jar
COPY --chown=dayfeel:dayfeel docker-entrypoint.sh /app/docker-entrypoint.sh
USER dayfeel
EXPOSE 8081
ENTRYPOINT ["sh","/app/docker-entrypoint.sh"]
