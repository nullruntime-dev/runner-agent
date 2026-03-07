package dev.runner.agent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {"agent.token=test-token"})
class RunnerAgentApplicationTests {

    @Test
    void contextLoads() {
    }
}
