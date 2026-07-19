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
  package dev.runner.agent.adk;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "agent.adk")
@Data
public class AdkConfig {

    private boolean enabled = true;
    private String provider = "gemini";  // "gemini" or "ollama"
    private String model = "gemini-2.0-flash";
    private String apiKey;

    // Ollama settings
    private String ollamaBaseUrl = "http://127.0.0.1:11434";
    private String ollamaModel = "llama3.1:8b";

    public boolean isOllama() {
        return "ollama".equalsIgnoreCase(provider);
    }

    public boolean isGemini() {
        return "gemini".equalsIgnoreCase(provider);
    }
}
