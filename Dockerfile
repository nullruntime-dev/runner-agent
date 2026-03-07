FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY build/libs/runner-agent-0.1.0-SNAPSHOT.jar app.jar
EXPOSE 8090
ENTRYPOINT ["java", "-jar", "app.jar"]
