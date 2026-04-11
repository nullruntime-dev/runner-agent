/*
 * Copyright 2024-2026 Hamim Alam
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package dev.runner.agent.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, String> {

    Optional<ChatSession> findByIdAndArchivedAtIsNull(String id);

    List<ChatSession> findAllByArchivedAtIsNullOrderByUpdatedAtDesc();

    List<ChatSession> findAllByArchivedAtIsNullOrderByUpdatedAtDesc(Pageable pageable);

    @Query("SELECT s FROM ChatSession s LEFT JOIN FETCH s.messages WHERE s.id = :id AND s.archivedAt IS NULL")
    Optional<ChatSession> findByIdWithMessages(@Param("id") String id);
}
