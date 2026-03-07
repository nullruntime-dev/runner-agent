package dev.runner.agent.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "log_lines")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "execution_id", nullable = false)
    private String executionId;

    @Column(nullable = false)
    private String stepName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String line;

    @Column(nullable = false)
    private String stream;

    @Column(nullable = false)
    private Instant createdAt;
}
