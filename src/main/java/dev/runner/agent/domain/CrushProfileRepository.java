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

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CrushProfileRepository extends JpaRepository<CrushProfile, Long> {

    Optional<CrushProfile> findBySessionIdAndName(String sessionId, String name);

    // Case-insensitive name lookup
    Optional<CrushProfile> findBySessionIdAndNameIgnoreCase(String sessionId, String name);

    // Partial name match (contains)
    List<CrushProfile> findBySessionIdAndNameContainingIgnoreCase(String sessionId, String name);

    // Search by display name
    Optional<CrushProfile> findBySessionIdAndDisplayNameIgnoreCase(String sessionId, String displayName);

    List<CrushProfile> findBySessionIdOrderByUpdatedAtDesc(String sessionId);

    Optional<CrushProfile> findFirstBySessionIdOrderByUpdatedAtDesc(String sessionId);

    void deleteBySessionIdAndName(String sessionId, String name);

    // Global lookups (across all sessions)
    Optional<CrushProfile> findFirstByNameOrderByUpdatedAtDesc(String name);

    Optional<CrushProfile> findFirstByNameIgnoreCaseOrderByUpdatedAtDesc(String name);

    Optional<CrushProfile> findFirstByDisplayNameIgnoreCaseOrderByUpdatedAtDesc(String displayName);

    List<CrushProfile> findByNameContainingIgnoreCaseOrderByUpdatedAtDesc(String name);

    // Get ALL profiles with exact name match (for finding the best one)
    List<CrushProfile> findByNameIgnoreCaseOrderByUpdatedAtDesc(String name);

    List<CrushProfile> findAllByOrderByUpdatedAtDesc();

    void deleteByName(String name);
}
