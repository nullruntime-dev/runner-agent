package com.cli.executor.controller;

import com.cli.executor.services.ExecuteDTO;
import com.cli.executor.services.ExecutorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/executor")
@RequiredArgsConstructor
public class ExecutorController {
    private final ExecutorService executorService;


    @GetMapping("/health")
    public String health() {
        return "OK";
    }

    @PostMapping("/run")
    public String run(@RequestBody ExecuteDTO executeDTO) {
        return executorService.runSync(executeDTO.getCommands(), executeDTO.getToken());
    }
}
