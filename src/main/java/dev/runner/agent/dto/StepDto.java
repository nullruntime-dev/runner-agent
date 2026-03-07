package dev.runner.agent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StepDto {

    @NotBlank(message = "step name is required")
    private String name;

    @NotBlank(message = "run command is required")
    private String run;

    private int timeout = 60;

    private boolean continueOnError = false;
}
