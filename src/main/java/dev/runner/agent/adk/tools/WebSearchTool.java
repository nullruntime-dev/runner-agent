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
package dev.runner.agent.adk.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.adk.tools.Annotations.Schema;
import dev.runner.agent.service.SkillService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Slf4j
@Component
public class WebSearchTool {

    private static final String GOOGLE_SEARCH_API = "https://www.googleapis.com/customsearch/v1";

    private final SkillService skillService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public WebSearchTool(SkillService skillService, ObjectMapper objectMapper) {
        this.skillService = skillService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("WebSearchTool initialized");
    }

    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("web-search");
    }

    private String getApiKey() {
        return getConfig().map(c -> c.get("apiKey")).orElse(null);
    }

    private String getSearchEngineId() {
        return getConfig().map(c -> c.get("searchEngineId")).orElse(null);
    }

    public boolean isConfigured() {
        String apiKey = getApiKey();
        String cx = getSearchEngineId();
        return apiKey != null && !apiKey.isBlank() && cx != null && !cx.isBlank();
    }

    @Schema(
        name = "web_search",
        description = "Search the web using Google Custom Search. Returns titles, snippets, and URLs of search results. Use this to find current information, documentation, tutorials, or answers to questions."
    )
    public Map<String, Object> search(
            @Schema(name = "query", description = "The search query string") String query,
            @Schema(name = "num_results", description = "Number of results to return (1-10, default 5)", optional = true) Integer numResults
    ) {
        log.info("ADK tool: web_search query={}", query);
        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Web Search is not configured. Please configure it in settings with both Google API Key and Custom Search Engine ID (cx parameter).");
            return result;
        }

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        int num = (numResults != null && numResults >= 1 && numResults <= 10) ? numResults : 5;

        try {
            List<Map<String, String>> searchResults = performSearch(query, num, null, null);
            result.put("success", true);
            result.put("query", query);
            result.put("results", searchResults);
            result.put("count", searchResults.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Search failed: " + e.getMessage());
            log.error("Web search failed", e);
        }

        return result;
    }

    @Schema(
        name = "web_search_news",
        description = "Search for recent news articles using Google Custom Search. Useful for finding current events, recent announcements, or breaking news."
    )
    public Map<String, Object> searchNews(
            @Schema(name = "query", description = "The news search query string") String query,
            @Schema(name = "num_results", description = "Number of results to return (1-10, default 5)", optional = true) Integer numResults,
            @Schema(name = "date_restrict", description = "Restrict results to recent time period: d[number] for days, w[number] for weeks, m[number] for months (e.g., 'd7' for last 7 days, 'w2' for last 2 weeks)", optional = true) String dateRestrict
    ) {
        log.info("ADK tool: web_search_news query={} dateRestrict={}", query, dateRestrict);
        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Web Search is not configured. Please configure it in settings with both Google API Key and Custom Search Engine ID (cx parameter).");
            return result;
        }

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        int num = (numResults != null && numResults >= 1 && numResults <= 10) ? numResults : 5;
        String restrict = (dateRestrict != null && !dateRestrict.isBlank()) ? dateRestrict : "w1";

        try {
            List<Map<String, String>> searchResults = performSearch(query, num, restrict, null);
            result.put("success", true);
            result.put("query", query);
            result.put("dateRestrict", restrict);
            result.put("results", searchResults);
            result.put("count", searchResults.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "News search failed: " + e.getMessage());
            log.error("Web news search failed", e);
        }

        return result;
    }

    @Schema(
        name = "web_search_site",
        description = "Search within a specific website using Google Custom Search. Useful for finding documentation, API references, or content within a particular domain."
    )
    public Map<String, Object> searchSite(
            @Schema(name = "query", description = "The search query string") String query,
            @Schema(name = "site", description = "The website domain to search within (e.g., 'docs.oracle.com', 'stackoverflow.com')") String site,
            @Schema(name = "num_results", description = "Number of results to return (1-10, default 5)", optional = true) Integer numResults
    ) {
        log.info("ADK tool: web_search_site query={} site={}", query, site);
        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Web Search is not configured. Please configure it in settings with both Google API Key and Custom Search Engine ID (cx parameter).");
            return result;
        }

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        if (site == null || site.isBlank()) {
            result.put("success", false);
            result.put("error", "Site domain is required");
            return result;
        }

        int num = (numResults != null && numResults >= 1 && numResults <= 10) ? numResults : 5;

        try {
            List<Map<String, String>> searchResults = performSearch(query, num, null, site);
            result.put("success", true);
            result.put("query", query);
            result.put("site", site);
            result.put("results", searchResults);
            result.put("count", searchResults.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Site search failed: " + e.getMessage());
            log.error("Web site search failed", e);
        }

        return result;
    }

    private List<Map<String, String>> performSearch(String query, int num, String dateRestrict, String site) throws Exception {
        String apiKey = getApiKey();
        String cx = getSearchEngineId();

        log.info("WebSearch config - apiKey={}, cx={}",
            apiKey != null ? apiKey.substring(0, Math.min(10, apiKey.length())) + "..." : "null",
            cx);

        StringBuilder urlBuilder = new StringBuilder(GOOGLE_SEARCH_API);
        urlBuilder.append("?key=").append(URLEncoder.encode(apiKey, StandardCharsets.UTF_8));
        urlBuilder.append("&cx=").append(URLEncoder.encode(cx, StandardCharsets.UTF_8));

        // Add site restriction to query if specified
        String searchQuery = (site != null && !site.isBlank())
                ? "site:" + site + " " + query
                : query;
        urlBuilder.append("&q=").append(URLEncoder.encode(searchQuery, StandardCharsets.UTF_8));
        urlBuilder.append("&num=").append(num);

        if (dateRestrict != null && !dateRestrict.isBlank()) {
            urlBuilder.append("&dateRestrict=").append(URLEncoder.encode(dateRestrict, StandardCharsets.UTF_8));
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(urlBuilder.toString()))
                .header("Accept", "application/json")
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.warn("Google Search API error: {} - {}", response.statusCode(), response.body());
            throw new RuntimeException("Google Search API returned status " + response.statusCode());
        }

        return parseSearchResults(response.body());
    }

    private List<Map<String, String>> parseSearchResults(String jsonResponse) throws Exception {
        List<Map<String, String>> results = new ArrayList<>();

        JsonNode root = objectMapper.readTree(jsonResponse);
        JsonNode items = root.get("items");

        if (items == null || !items.isArray()) {
            return results;
        }

        for (JsonNode item : items) {
            Map<String, String> resultItem = new HashMap<>();
            resultItem.put("title", getTextOrDefault(item, "title", "No title"));
            resultItem.put("link", getTextOrDefault(item, "link", ""));
            resultItem.put("snippet", getTextOrDefault(item, "snippet", "No description available"));
            resultItem.put("displayLink", getTextOrDefault(item, "displayLink", ""));

            // Extract additional metadata if available
            JsonNode pagemap = item.get("pagemap");
            if (pagemap != null) {
                JsonNode metatags = pagemap.get("metatags");
                if (metatags != null && metatags.isArray() && metatags.size() > 0) {
                    JsonNode meta = metatags.get(0);
                    String publishedDate = getTextOrDefault(meta, "article:published_time", null);
                    if (publishedDate == null) {
                        publishedDate = getTextOrDefault(meta, "og:updated_time", null);
                    }
                    if (publishedDate != null) {
                        resultItem.put("publishedDate", publishedDate);
                    }
                }
            }

            results.add(resultItem);
        }

        return results;
    }

    private String getTextOrDefault(JsonNode node, String field, String defaultValue) {
        JsonNode fieldNode = node.get(field);
        if (fieldNode != null && fieldNode.isTextual()) {
            return fieldNode.asText();
        }
        return defaultValue;
    }
}
