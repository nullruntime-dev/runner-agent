package dev.runner.agent.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "executions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Execution {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExecutionStatus status;

    @Column(columnDefinition = "TEXT")
    private String requestJson;

    private String shell;
    private String workingDir;
    private Integer exitCode;

    @Column(columnDefinition = "TEXT")
    private String error;

    private Instant startedAt;
    private Instant completedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "execution", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("stepIndex ASC")
    @Builder.Default
    private List<StepResult> steps = new ArrayList<>();
}
