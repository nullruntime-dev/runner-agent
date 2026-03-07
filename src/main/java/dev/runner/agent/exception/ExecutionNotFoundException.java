package dev.runner.agent.exception;

public class ExecutionNotFoundException extends AgentException {

    public ExecutionNotFoundException(String id) {
        super("Execution not found: " + id);
    }
}
