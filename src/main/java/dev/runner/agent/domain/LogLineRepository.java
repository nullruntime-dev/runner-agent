package dev.runner.agent.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogLineRepository extends JpaRepository<LogLine, Long> {

    List<LogLine> findByExecutionIdOrderByCreatedAtAsc(String executionId);
}
