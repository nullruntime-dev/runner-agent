package dev.runner.agent.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StepResultRepository extends JpaRepository<StepResult, Long> {

    List<StepResult> findByExecutionIdOrderByStepIndexAsc(String executionId);
}
