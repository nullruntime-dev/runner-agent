package dev.runner.agent.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecutionRepository extends JpaRepository<Execution, String> {

    List<Execution> findByStatusOrderByCreatedAtDesc(ExecutionStatus status, Pageable pageable);

    List<Execution> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
