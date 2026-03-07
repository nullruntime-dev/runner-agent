package dev.runner.agent.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "agent")
@Data
public class AgentConfig {

    private String token;
    private String workingDir = "/tmp";
    private String defaultShell = "/bin/sh";
    private int maxConcurrent = 5;

    @PostConstruct
    public void validate() {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException(
                    "AGENT_TOKEN environment variable must be set before starting the agent");
        }
    }
}
