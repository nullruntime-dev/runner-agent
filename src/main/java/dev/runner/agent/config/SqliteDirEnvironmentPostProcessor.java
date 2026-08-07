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
package dev.runner.agent.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Ensures the parent directory of the SQLite database file exists before Spring
 * refreshes any beans. xerial sqlite-jdbc does not create the parent directory
 * itself, so a fresh checkout would fail at Hibernate DDL time with
 * "path to './data/runner.db': '...' does not exist".
 *
 * Runs before the DataSource/EntityManagerFactory beans are created, which is
 * earlier than @PostConstruct on the main configuration class can guarantee.
 */
public class SqliteDirEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        // At this early stage application.yml may not be loaded yet (ConfigDataEnvironmentPostProcessor
        // runs alongside us), so read SPRING_DATASOURCE_URL directly from env/system props and fall
        // back to the same default as application.yml. Env vars are in the environment from the start.
        String url = environment.getProperty("SPRING_DATASOURCE_URL");
        if (url == null || url.isEmpty()) {
            url = "jdbc:sqlite:./data/runner.db?journal_mode=WAL&busy_timeout=5000";
        }
        if (!url.startsWith("jdbc:sqlite:")) return;

        String pathPart = url.substring("jdbc:sqlite:".length());
        int q = pathPart.indexOf('?');
        if (q >= 0) pathPart = pathPart.substring(0, q);

        Path dbPath = Paths.get(pathPart);
        if (!dbPath.isAbsolute()) dbPath = Paths.get(System.getProperty("user.dir")).resolve(dbPath);
        Path parent = dbPath.getParent();
        if (parent == null) return;
        try {
            Files.createDirectories(parent);
        } catch (IOException ignored) {
            // Best-effort; let the JDBC driver surface the real error if it fails.
        }
    }
}