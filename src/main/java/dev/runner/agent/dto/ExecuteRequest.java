package dev.runner.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExecuteRequest {

    private String id;

    @NotBlank(message = "name is required")
    private String name;

    @NotEmpty(message = "steps cannot be empty")
    private List<StepDto> steps;

    private Map<String, String> env = new HashMap<>();

    private String workingDir;

    private String shell;

    private int timeout = 300;
}
