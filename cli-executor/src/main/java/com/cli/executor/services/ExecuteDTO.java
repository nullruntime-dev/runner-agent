package com.cli.executor.services;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Data
@Getter
@Setter
public class ExecuteDTO {
    List<String> commands;
    String token;
}
