package dev.runner.agent.dto;

import dev.runner.agent.domain.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecuteResponse {

    private String id;
    private ExecutionStatus status;
}
