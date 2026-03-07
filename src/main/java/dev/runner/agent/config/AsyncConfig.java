package dev.runner.agent.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "agentExecutor")
    public Executor agentExecutor(AgentConfig config) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(config.getMaxConcurrent());
        executor.setMaxPoolSize(config.getMaxConcurrent());
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("agent-exec-");
        executor.initialize();
        return executor;
    }
}
