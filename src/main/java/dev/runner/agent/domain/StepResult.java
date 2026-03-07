package dev.runner.agent.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "step_results")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StepResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "execution_id", nullable = false)
    @JsonIgnore
    private Execution execution;

    @Column(nullable = false)
    private int stepIndex;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String run;

    @Enumerated(EnumType.STRING)
    private ExecutionStatus status;

    private Integer exitCode;

    @Column(columnDefinition = "TEXT")
    private String output;

    @Column(columnDefinition = "TEXT")
    private String error;

    private boolean continueOnError;
    private Instant startedAt;
    private Instant completedAt;
}
