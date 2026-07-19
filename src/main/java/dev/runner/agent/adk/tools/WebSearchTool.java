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
import dev.runner.agent.domain.Execution;
import dev.runner.agent.domain.ExecutionStatus;
import dev.runner.agent.domain.ExecutionRepository;
import dev.runner.agent.domain.StepResult;
import dev.runner.agent.domain.StepResultRepository;
import dev.runner.agent.dto.ExecuteRequest;
import dev.runner.agent.dto.StepDto;
import dev.runner.agent.executor.ExecutorService;
import dev.runner.agent.service.SkillService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
public class WebSearchTool {

    private static final int MAX_SEARCHES_PER_SESSION = 30;
    private final SkillService skillService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final ExecutorService executorService;
    private final ExecutionRepository executionRepository;
    private final StepResultRepository stepResultRepository;
    private static final Map<String, AtomicInteger> sessionSearchCounts = new java.util.concurrent.ConcurrentHashMap<>();

    @Value("${searxng.base-url:}")
    private String envBaseUrl;

    @Value("${ddgo.base-url:}")
    private String ddgoBaseUrl;

    @Value("${ddgo.html:}")
    private String ddgoHtmlUrl;

    public WebSearchTool(SkillService skillService,
                         ObjectMapper objectMapper,
                         ExecutorService executorService,
                         ExecutionRepository executionRepository,
                         StepResultRepository stepResultRepository) {
        this.skillService = skillService;
        this.objectMapper = objectMapper;
        this.executorService = executorService;
        this.executionRepository = executionRepository;
        this.stepResultRepository = stepResultRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("WebSearchTool initialized (SearXNG + DuckDuckGo + curl via ExecutorService, max {} searches/session)", MAX_SEARCHES_PER_SESSION);
    }
    private Optional<Map<String, String>> getConfig() {
        return skillService.getSkillConfig("web-search");
    }

    private String getBaseUrl() {
        String fromConfig = getConfig().map(c -> c.get("baseUrl")).orElse(null);
        if (fromConfig != null && !fromConfig.isBlank()) {
            return fromConfig;
        }
        return envBaseUrl;
    }

    private String getDdgoApiUrl() {
        if (ddgoBaseUrl != null && !ddgoBaseUrl.isBlank()) {
            return ddgoBaseUrl;
        }
        return "https://duckduckgo.com";
    }

    private String getDdgoHtmlUrl() {
        if (ddgoHtmlUrl != null && !ddgoHtmlUrl.isBlank()) {
            return ddgoHtmlUrl;
        }
        return "https://html.duckduckgo.com/html";
    }

    public boolean isConfigured() {
        String searxng = getBaseUrl();
        return (searxng != null && !searxng.isBlank())
                || (ddgoBaseUrl != null && !ddgoBaseUrl.isBlank())
                || (ddgoHtmlUrl != null && !ddgoHtmlUrl.isBlank());
    }

    @Schema(
        name = "web_search",
        description = "Search the web using SearXNG and DuckDuckGo (HTML + Instant Answer API) in parallel. Results from all configured sources are merged and deduplicated by URL. Returns titles, snippets, URLs, and the source engine of each result. Use this to find current information, documentation, tutorials, or answers to questions."
    )
    public Map<String, Object> search(
            @Schema(name = "query", description = "The search query string") String query,
            @Schema(name = "num_results", description = "Number of results to return (1-30, default 10)", optional = true) Integer numResults
    ) {
        log.info("ADK tool: web_search query={}", query);
        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Web Search is not configured. Set the SearXNG base URL or DuckDuckGo URL in the web-search skill settings or env vars.");
            return result;
        }

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        int num = (numResults != null && numResults >= 1 && numResults <= 30) ? numResults : 10;

        try {
            List<Map<String, String>> searchResults = performSearch(query, num, null, null, null);
            result.put("success", true);
            result.put("query", query);
            result.put("results", searchResults);
            result.put("count", searchResults.size());
        } catch (SearchLimitException e) {
            return stopResult();
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Search failed: " + e.getMessage());
            log.error("Web search failed", e);
        }

        return result;
    }

    @Schema(
        name = "web_search_news",
        description = "Search for recent news articles using SearXNG. Useful for finding current events, recent announcements, or breaking news."
    )
    public Map<String, Object> searchNews(
            @Schema(name = "query", description = "The news search query string") String query,
            @Schema(name = "num_results", description = "Number of results to return (1-30, default 10)", optional = true) Integer numResults,
            @Schema(name = "time_range", description = "Restrict results to recent time period: 'day', 'week', 'month', or 'year' (default: 'week')", optional = true) String timeRange
    ) {
        log.info("ADK tool: web_search_news query={} timeRange={}", query, timeRange);
        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Web Search is not configured. Set the SearXNG base URL or DuckDuckGo URL in the web-search skill settings or env vars.");
            return result;
        }

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        int num = (numResults != null && numResults >= 1 && numResults <= 30) ? numResults : 10;
        String range = (timeRange != null && !timeRange.isBlank()) ? timeRange : "week";

        try {
            List<Map<String, String>> searchResults = performSearch(query, num, "news", range, null);
            result.put("success", true);
            result.put("query", query);
            result.put("timeRange", range);
            result.put("results", searchResults);
            result.put("count", searchResults.size());
        } catch (SearchLimitException e) {
            return stopResult();
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "News search failed: " + e.getMessage());
            log.error("Web news search failed", e);
        }

        return result;
    }

    @Schema(
        name = "web_search_site",
        description = "Search within a specific website using SearXNG. Useful for finding documentation, API references, or content within a particular domain."
    )
    public Map<String, Object> searchSite(
            @Schema(name = "query", description = "The search query string") String query,
            @Schema(name = "site", description = "The website domain to search within (e.g., 'docs.oracle.com', 'stackoverflow.com')") String site,
            @Schema(name = "num_results", description = "Number of results to return (1-30, default 10)", optional = true) Integer numResults
    ) {
        log.info("ADK tool: web_search_site query={} site={}", query, site);
        Map<String, Object> result = new HashMap<>();

        if (!isConfigured()) {
            result.put("success", false);
            result.put("error", "Web Search is not configured. Set the SearXNG base URL or DuckDuckGo URL in the web-search skill settings or env vars.");
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

        int num = (numResults != null && numResults >= 1 && numResults <= 30) ? numResults : 10;

        try {
            List<Map<String, String>> searchResults = performSearch(query, num, null, null, site);
            result.put("success", true);
            result.put("query", query);
            result.put("site", site);
            result.put("results", searchResults);
            result.put("count", searchResults.size());
        } catch (SearchLimitException e) {
            return stopResult();
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Site search failed: " + e.getMessage());
            log.error("Web site search failed", e);
        }

        return result;
    }

    public static class SearchLimitException extends RuntimeException {
        public SearchLimitException(String message) { super(message); }
    }

    private Map<String, Object> stopResult() {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("results", List.of());
        result.put("count", 0);
        result.put("instruction", "STOP SEARCHING. You have used all your web searches. Use the results from your previous searches to complete the task NOW. If the task is to send an email, send it with what you have. Do NOT search again.");
        return result;
    }

    private String getSessionKey() {
        String session = FlirtTool.getCurrentSession();
        return session != null ? session : "default";
    }

    public static void clearSessionSearchCount(String sessionId) {
        if (sessionId != null) {
            sessionSearchCounts.remove(sessionId);
        }
    }

    private List<Map<String, String>> performSearch(String query, int num, String category, String timeRange, String site) throws Exception {
        String sessionKey = getSessionKey();
        AtomicInteger count = sessionSearchCounts.computeIfAbsent(sessionKey, k -> new AtomicInteger(0));

        if (count.get() >= MAX_SEARCHES_PER_SESSION) {
            log.warn("Search limit ({}) reached for session {}, returning stop signal", MAX_SEARCHES_PER_SESSION, sessionKey);
            throw new SearchLimitException("STOP SEARCHING. You have already used all " + MAX_SEARCHES_PER_SESSION
                    + " web searches. Use the results you already have to complete the task NOW (send the email, write the report). Do NOT call any search tool again.");
        }

        int searchNum = count.incrementAndGet();
        log.info("Web search {}/{} for session: {}", searchNum, MAX_SEARCHES_PER_SESSION, sessionKey);

        // Build the list of configured sources to query in parallel.
        List<java.util.concurrent.Callable<List<Map<String, String>>>> tasks = new ArrayList<>();
        List<String> sourceNames = new ArrayList<>();

        // For site-restricted search, push 'site:domain' into the query for
        // sources that support it (SearXNG). DDG HTML/API don't support
        // server-side site filter, so we skip them rather than returning
        // irrelevant results that the post-hoc URL filter would drop.
        final String effectiveQuery;
        boolean siteRestricted = site != null && !site.isBlank();
        if (siteRestricted) {
            effectiveQuery = query + " site:" + site;
        } else {
            effectiveQuery = query;
        }

        String searxng = getBaseUrl();
        if (searxng != null && !searxng.isBlank()) {
            tasks.add(() -> searchSearxng(effectiveQuery, num, category, timeRange));
            sourceNames.add("SearXNG");
        }
        if (!siteRestricted) {
            String ddgoHtml = getDdgoHtmlUrl();
            if (ddgoHtml != null && !ddgoHtml.isBlank()) {
                tasks.add(() -> searchDdgoHtml(query, num));
                sourceNames.add("DuckDuckGo-HTML");
            }
            String ddgoApi = getDdgoApiUrl();
            if (ddgoApi != null && !ddgoApi.isBlank()) {
                tasks.add(() -> searchDdgoApi(query, num));
                sourceNames.add("DuckDuckGo-API");
            }
        }

        if (tasks.isEmpty()) {
            log.warn("No search source configured");
            return List.of();
        }

        log.info("Running {} search sources in parallel: {} (num={}, site={})", tasks.size(), sourceNames, num, site);

        // Run all sources in parallel, collect results.
        java.util.concurrent.ExecutorService exec = java.util.concurrent.Executors.newFixedThreadPool(Math.min(tasks.size(), 3));
        List<java.util.concurrent.Future<List<Map<String, String>>>> futures;
        List<Map<String, String>> merged = new ArrayList<>();
        try {
            futures = exec.invokeAll(tasks, 35, java.util.concurrent.TimeUnit.SECONDS);
            for (int i = 0; i < futures.size(); i++) {
                String src = sourceNames.get(i);
                try {
                    List<Map<String, String>> r = futures.get(i).get();
                    for (Map<String, String> item : r) {
                        item.putIfAbsent("source", src);
                        merged.add(item);
                    }
                    log.info("Source {} returned {} results", src, r.size());
                } catch (Exception e) {
                    log.warn("Source {} failed: {}", src, e.getMessage());
                }
            }
        } finally {
            exec.shutdownNow();
        }

        // Dedupe by URL, preserving insertion order (first source wins on conflict).
        Map<String, Map<String, String>> deduped = new java.util.LinkedHashMap<>();
        for (Map<String, String> item : merged) {
            String url = item.getOrDefault("link", "").toLowerCase();
            String key = url.isEmpty() ? item.getOrDefault("title", "") + "|" + item.getOrDefault("snippet", "") : url;
            deduped.putIfAbsent(key, item);
        }
        List<Map<String, String>> dedupedResults = new ArrayList<>(deduped.values());

        // Filter by site if specified
        if (site != null && !site.isBlank()) {
            String siteLower = site.toLowerCase();
            dedupedResults = dedupedResults.stream()
                    .filter(r -> {
                        String url = r.getOrDefault("link", "").toLowerCase();
                        return url.contains(siteLower);
                    })
                    .toList();
        }

        // Limit to requested number
        if (dedupedResults.size() > num) {
            dedupedResults = new ArrayList<>(dedupedResults.subList(0, num));
        }

        log.info("Merged search: {} raw -> {} deduped -> {} returned (num={}, site={})",
                merged.size(), deduped.size(), dedupedResults.size(), num, site);
        return dedupedResults;
    }

    // -- SearXNG ---------------------------------------------------------------
    private List<Map<String, String>> searchSearxng(String query, int num, String category, String timeRange) throws Exception {
        String baseUrl = getBaseUrl().replaceAll("/+$", "");

        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("/search?format=json");
        urlBuilder.append("&q=").append(URLEncoder.encode(query, StandardCharsets.UTF_8));

        if (category != null && !category.isBlank()) {
            urlBuilder.append("&categories=").append(URLEncoder.encode(category, StandardCharsets.UTF_8));
        }
        if (timeRange != null && !timeRange.isBlank()) {
            urlBuilder.append("&time_range=").append(URLEncoder.encode(timeRange, StandardCharsets.UTF_8));
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(urlBuilder.toString()))
                .header("Accept", "application/json")
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.warn("SearXNG API error: {} - {}", response.statusCode(), response.body());
            throw new RuntimeException("SearXNG returned status " + response.statusCode());
        }

        List<Map<String, String>> results = parseSearchResults(response.body());
        if (results.size() > num) results = new ArrayList<>(results.subList(0, num));
        return results;
    }

    // -- DuckDuckGo HTML scraper ----------------------------------------------
    // GET https://html.duckduckgo.com/html/?q=<query> — returns parseable HTML.
    // Regex-based since the project doesn't have Jsoup.
    private List<Map<String, String>> searchDdgoHtml(String query, int num) throws Exception {
        String endpoint = getDdgoHtmlUrl().replaceAll("/+$", "");
        String url = endpoint + "/?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "text/html")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String responseBody = response.body();
        int status = response.statusCode();

        // DDG returns HTTP 202 with the anomaly/bot-detection page when it
        // doesn't like the source IP. Treat 202 + anomaly body as a soft failure.
        if (status != 200) {
            boolean isAnomaly = responseBody != null
                    && (responseBody.contains("anomaly-modal__title")
                        || responseBody.contains("bots use DuckDuckGo"));
            if (isAnomaly) {
                log.warn("DDG HTML returned anomaly/bot-detection page (status {}, {} bytes)", status, responseBody.length());
                throw new RuntimeException("DuckDuckGo HTML is showing a bot-detection wall (anomaly page). Try again later, or disable the ddgo.html source.");
            }
            log.warn("DDG HTML error: {} - body length {}", status, responseBody == null ? 0 : responseBody.length());
            throw new RuntimeException("DuckDuckGo HTML returned status " + status);
        }

        // 200 could still be the anomaly page in rare cases — check the body.
        if (responseBody.contains("anomaly-modal__title") || responseBody.contains("bots use DuckDuckGo")) {
            log.warn("DDG HTML returned anomaly/bot-detection page ({} bytes) despite 200 OK", responseBody.length());
            throw new RuntimeException("DuckDuckGo HTML is showing a bot-detection wall (anomaly page). Try again later, or disable the ddgo.html source.");
        }

        return parseDdgoHtml(responseBody, num);
    }

    private List<Map<String, String>> parseDdgoHtml(String html, int num) {
        List<Map<String, String>> results = new ArrayList<>();

        // DDG HTML uses class="result__url" for the link, class="result__a" for title,
        // class="result__snippet" for the snippet. Some installs use /l/?uddg= redirects.
        java.util.regex.Pattern resultPattern = java.util.regex.Pattern.compile(
            "<a[^>]+class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>[\\s\\S]*?" +
            "<a[^>]+class=\"result__snippet\"[^>]*>(.*?)</a>",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Pattern tagPattern = java.util.regex.Pattern.compile("<[^>]+>");

        java.util.regex.Matcher m = resultPattern.matcher(html);
        int seen = 0;
        while (m.find() && seen < num) {
            String rawUrl = m.group(1);
            String title = stripTags(tagPattern, m.group(2)).trim();
            String snippet = stripTags(tagPattern, m.group(3)).trim();

            // DDG uses /l/?uddg=<encoded> redirects — unwrap them.
            String url = unwrapDdgRedirect(rawUrl);

            if (url.isEmpty() && title.isEmpty()) continue;

            Map<String, String> item = new HashMap<>();
            item.put("title", title.isEmpty() ? "(no title)" : title);
            item.put("link", url);
            item.put("snippet", snippet.isEmpty() ? "No description available" : snippet);
            item.put("displayLink", extractHost(url));
            item.put("engine", "duckduckgo-html");
            results.add(item);
            seen++;
        }
        return results;
    }

    private String stripTags(java.util.regex.Pattern tagPattern, String s) {
        if (s == null) return "";
        return tagPattern.matcher(s).replaceAll("");
    }

    private String unwrapDdgRedirect(String rawUrl) {
        if (rawUrl == null) return "";
        // DDG HTML endpoint wraps external URLs as /l/?uddg=<encoded url>&...
        int uddgIdx = rawUrl.indexOf("uddg=");
        if (uddgIdx >= 0) {
            int start = uddgIdx + 5;
            int end = rawUrl.indexOf('&', start);
            String encoded = end < 0 ? rawUrl.substring(start) : rawUrl.substring(start, end);
            try {
                return java.net.URLDecoder.decode(encoded, StandardCharsets.UTF_8);
            } catch (Exception e) {
                return rawUrl;
            }
        }
        return rawUrl;
    }

    private String extractHost(String url) {
        try {
            if (url == null || url.isBlank()) return "";
            if (!url.startsWith("http")) url = "https://" + url;
            return new URI(url).getHost();
        } catch (Exception e) {
            return "";
        }
    }

    // -- DuckDuckGo Instant Answer API (JSON) ---------------------------------
    private List<Map<String, String>> searchDdgoApi(String query, int num) throws Exception {
        String endpoint = getDdgoApiUrl().replaceAll("/+$", "");
        String url = endpoint + "/?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
                + "&format=json&no_html=1&skip_disambig=1";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/json")
                .header("User-Agent", "Mozilla/5.0")
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.warn("DDG API error: {} - {}", response.statusCode(), response.body().length());
            throw new RuntimeException("DuckDuckGo API returned status " + response.statusCode());
        }

        return parseDdgoApi(response.body(), num);
    }

    private List<Map<String, String>> parseDdgoApi(String json, int num) throws Exception {
        List<Map<String, String>> results = new ArrayList<>();
        JsonNode root = objectMapper.readTree(json);

        // DDG Instant Answer API returns one main Abstract and zero or more
        // RelatedTopics. These are not "search results" in the Google sense —
        // they're answer-box-style entries. We map them to our shape so they
        // get merged with SearXNG/HTML results.

        JsonNode abstractNode = root.get("AbstractText");
        if (abstractNode != null && !abstractNode.isNull() && !abstractNode.asText().isBlank()) {
            Map<String, String> item = new HashMap<>();
            item.put("title", getTextOrDefault(root, "Heading", "DuckDuckGo Answer"));
            item.put("link", getTextOrDefault(root, "AbstractURL", ""));
            item.put("snippet", abstractNode.asText());
            item.put("displayLink", getTextOrDefault(root, "AbstractSource", ""));
            item.put("engine", "duckduckgo-api");
            results.add(item);
        }

        JsonNode related = root.get("RelatedTopics");
        if (related != null && related.isArray()) {
            for (JsonNode topic : related) {
                if (results.size() >= num) break;
                JsonNode text = topic.get("Text");
                JsonNode firstUrl = topic.get("FirstURL");
                if (text == null || text.isNull() || text.asText().isBlank()) {
                    // Could be a topic group — skip for simplicity.
                    continue;
                }
                Map<String, String> item = new HashMap<>();
                String t = text.asText();
                int dashIdx = t.indexOf(" - ");
                item.put("title", dashIdx > 0 ? t.substring(0, dashIdx).trim() : t);
                item.put("link", firstUrl != null ? firstUrl.asText() : "");
                item.put("snippet", dashIdx > 0 ? t.substring(dashIdx + 3).trim() : t);
                item.put("displayLink", extractHost(item.get("link")));
                item.put("engine", "duckduckgo-api");
                results.add(item);
            }
        }
        return results;
    }

    private List<Map<String, String>> parseSearchResults(String jsonResponse) throws Exception {
        List<Map<String, String>> results = new ArrayList<>();

        JsonNode root = objectMapper.readTree(jsonResponse);
        JsonNode items = root.get("results");

        if (items == null || !items.isArray()) {
            return results;
        }

        for (JsonNode item : items) {
            Map<String, String> resultItem = new HashMap<>();
            resultItem.put("title", getTextOrDefault(item, "title", "No title"));
            resultItem.put("link", getTextOrDefault(item, "url", ""));
            resultItem.put("snippet", getTextOrDefault(item, "content", "No description available"));
            resultItem.put("displayLink", getTextOrDefault(item, "pretty_url", getTextOrDefault(item, "hostname", "")));
            resultItem.put("engine", getTextOrDefault(item, "engine", ""));

            // Published date if available (SearXNG may include it depending on engine)
            String publishedDate = getTextOrDefault(item, "publishedDate", null);
            if (publishedDate != null) {
                resultItem.put("publishedDate", publishedDate);
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

    // =========================================================================
    // search_and_fetch — combined web_search + curl fetcher.
    //
    // Runs the normal search (SearXNG + DDG sources in parallel) AND
    // concurrently curl-fetches each URL the caller provided, cleans the HTML
    // (strips <script>/<style>/<head>, drops tags, decodes entities), extracts
    // the page's links, and returns everything merged: search results + page
    // content + page links. Use this when you need to read the actual content
    // of specific pages (not just snippets) alongside a regular search.
    // =========================================================================

    @Schema(
        name = "search_and_fetch",
        description = "Search the web (SearXNG + DuckDuckGo) AND fetch the full content of specific URLs in parallel. Use this when web_search snippets aren't enough — pass the URLs you want to read in full, and they'll be fetched, cleaned of HTML, and returned alongside the regular search results. Returns: search results + page contents + page links, all merged."
    )
    public Map<String, Object> searchAndFetch(
            @Schema(name = "query", description = "The search query string") String query,
            @Schema(name = "urls", description = "List of URLs to fetch in full (cleaned of HTML, returned as readable text + links)") java.util.List<String> urls,
            @Schema(name = "num_results", description = "Number of SEARCH results to return (1-30, default 10). Does not limit fetched URL content.", optional = true) Integer numResults,
            @Schema(name = "max_pages", description = "Max number of URLs to fetch (1-10, default 3). Each URL is one HTTP GET.", optional = true) Integer maxPages
    ) {
        log.info("ADK tool: search_and_fetch query={} urls={} maxPages={}", query, urls, maxPages);
        Map<String, Object> result = new HashMap<>();

        if (query == null || query.isBlank()) {
            result.put("success", false);
            result.put("error", "Search query is required");
            return result;
        }

        int num = (numResults != null && numResults >= 1 && numResults <= 30) ? numResults : 10;
        int maxP = (maxPages != null && maxPages >= 1 && maxPages <= 10) ? maxPages : 3;

        // Run search + fetch in parallel.
        java.util.List<java.util.concurrent.Callable<Object>> tasks = new java.util.ArrayList<>();
        java.util.List<String> taskNames = new java.util.ArrayList<>();

        // Search task — reuse existing performSearch (handles all source
        // selection + parallel merging + dedupe).
        tasks.add(() -> performSearch(query, num, null, null, null));
        taskNames.add("search");

        // DuckDuckGo Instant Answer API via curl — same endpoint as searchDdgoApi
        // but invoked through ExecutorService so it shows up as a real execution.
        // The query is whatever the user passed. URL-encoded for the API.
        final String ddgApiUrl = "https://api.duckduckgo.com/?q="
                + URLEncoder.encode(query, StandardCharsets.UTF_8)
                + "&format=json&no_html=1&skip_disambig=1";
        tasks.add(() -> fetchDdgApiViaCurl(ddgApiUrl, query, num));
        taskNames.add("ddg-api:" + ddgApiUrl);

        // Fetch tasks — one per URL, capped at maxP.
        java.util.List<String> fetchUrls = new java.util.ArrayList<>();
        if (urls != null) {
            for (int i = 0; i < Math.min(urls.size(), maxP); i++) {
                String u = urls.get(i);
                if (u == null || u.isBlank()) continue;
                final String url = u.trim();
                tasks.add(() -> fetchAndCleanUrl(url));
                taskNames.add("fetch:" + url);
                fetchUrls.add(url);
            }
        }

        java.util.concurrent.ExecutorService exec = java.util.concurrent.Executors.newFixedThreadPool(Math.min(tasks.size(), 6));
        List<java.util.concurrent.Future<Object>> futures;
        List<Map<String, String>> searchResults = new java.util.ArrayList<>();
        java.util.List<Map<String, Object>> fetchedPages = new java.util.ArrayList<>();
        try {
            futures = exec.invokeAll(tasks, 60, java.util.concurrent.TimeUnit.SECONDS);
            for (int i = 0; i < futures.size(); i++) {
                String name = taskNames.get(i);
                try {
                    Object r = futures.get(i).get();
                    if (name.equals("search")) {
                        @SuppressWarnings("unchecked")
                        List<Map<String, String>> sr = (List<Map<String, String>>) r;
                        searchResults.addAll(sr);
                        log.info("search_and_fetch: search returned {} results", sr.size());
                    } else if (name.startsWith("ddg-api:")) {
                        // DDG API results — already shaped as Map<String,String> items
                        // matching the search result shape. Merge directly into searchResults.
                        @SuppressWarnings("unchecked")
                        List<Map<String, String>> ddgResults = (List<Map<String, String>>) r;
                        searchResults.addAll(ddgResults);
                        log.info("search_and_fetch: DDG API (curl) returned {} results", ddgResults.size());
                    } else if (name.startsWith("fetch:")) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> page = (Map<String, Object>) r;
                        fetchedPages.add(page);
                        log.info("search_and_fetch: fetched {} ({} chars)",
                                page.get("url"), ((String) page.getOrDefault("content", "")).length());
                    }
                } catch (Exception e) {
                    log.warn("search_and_fetch: {} failed: {}", name, e.getMessage());
                }
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", "Parallel execution failed: " + e.getMessage());
            return result;
        } finally {
            exec.shutdownNow();
        }

        result.put("success", true);
        result.put("query", query);
        result.put("results", searchResults);
        result.put("count", searchResults.size());
        result.put("fetched_pages", fetchedPages);
        result.put("fetched_count", fetchedPages.size());
        return result;
    }

    /**
     * Run a curl command via the ExecutorService — same code path as the
     * execute_commands tool. Creates a one-step Execution, fires the async
     * execute(), polls until terminal, returns the curl stdout from the
     * persisted StepResult.output. The execution shows up in the UI's
     * execution viewer like any other shell command.
     *
     * Returns a small map: { stdout, exitCode, status, executionId, error? }.
     */
    private Map<String, Object> runCurlViaExecutor(String name, String curlCmd) {
        Map<String, Object> result = new HashMap<>();

        StepDto step = new StepDto();
        step.setName(name);
        step.setRun(curlCmd);
        step.setTimeout(30);
        step.setContinueOnError(false);

        ExecuteRequest request = new ExecuteRequest();
        request.setName(name);
        java.util.List<StepDto> steps = new java.util.ArrayList<>();
        steps.add(step);
        request.setSteps(steps);
        request.setEnv(new HashMap<>());
        request.setTimeout(30);

        Execution execution = executorService.createExecution(request);
        String executionId = execution.getId();
        log.info("curl via ExecutorService: name={} executionId={}", name, executionId);
        executorService.execute(executionId, request);

        ExecutionStatus finalStatus = null;
        long deadlineMs = System.currentTimeMillis() + 35_000;
        while (System.currentTimeMillis() < deadlineMs) {
            try { Thread.sleep(200); } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
            Execution current = executionRepository.findById(executionId).orElse(null);
            if (current == null) continue;
            ExecutionStatus s = current.getStatus();
            if (s == ExecutionStatus.SUCCESS || s == ExecutionStatus.FAILED || s == ExecutionStatus.CANCELLED) {
                finalStatus = s;
                break;
            }
        }

        if (finalStatus == null) {
            executorService.cancel(executionId);
            result.put("error", "curl execution timed out after 35s");
            result.put("stdout", "");
            result.put("executionId", executionId);
            return result;
        }

        java.util.List<StepResult> stepResults = stepResultRepository.findByExecutionIdOrderByStepIndexAsc(executionId);
        if (stepResults.isEmpty()) {
            result.put("error", "curl produced no step result");
            result.put("stdout", "");
            result.put("executionId", executionId);
            return result;
        }
        StepResult sr = stepResults.get(0);
        result.put("stdout", sr.getOutput() != null ? sr.getOutput() : "");
        result.put("exitCode", sr.getExitCode());
        result.put("executionStatus", finalStatus.name());
        result.put("executionId", executionId);
        if (finalStatus != ExecutionStatus.SUCCESS) {
            result.put("error", sr.getError() != null ? sr.getError() : "curl failed (exit " + sr.getExitCode() + ")");
        }
        return result;
    }

    /**
     * Curl the DuckDuckGo Instant Answer API (https://api.duckduckgo.com/?q=...)
     * via the ExecutorService, parse the JSON response into search result
     * items. This runs IN ADDITION to the regular searchDdgoApi source, and
     * shows up as a real execution in the UI.
     */
    private List<Map<String, String>> fetchDdgApiViaCurl(String apiUrl, String query, int num) {
        try {
            String curlCmd = "curl -L -s -S --max-time 15 "
                    + "-A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' "
                    + "-H 'Accept: application/json' "
                    + "-o - "
                    + "'" + apiUrl.replace("'", "'\\''") + "'";

            Map<String, Object> r = runCurlViaExecutor("ddg-api: " + query, curlCmd);
            String stdout = (String) r.getOrDefault("stdout", "");

            if (stdout.isBlank()) {
                log.warn("DDG API curl returned empty stdout (executionId={})", r.get("executionId"));
                return java.util.List.of();
            }

            // Parse the JSON response into search result items — same logic
            // as parseDdgoApi but inlined here so we don't need to expose it.
            return parseDdgApiJson(stdout, num);
        } catch (Exception e) {
            log.warn("DDG API curl failed for query '{}': {}", query, e.getMessage());
            return java.util.List.of();
        }
    }

    /** Parse a DuckDuckGo Instant Answer API JSON response into search result items. */
    private List<Map<String, String>> parseDdgApiJson(String json, int num) throws Exception {
        List<Map<String, String>> results = new ArrayList<>();
        JsonNode root = objectMapper.readTree(json);

        JsonNode abstractNode = root.get("AbstractText");
        if (abstractNode != null && !abstractNode.isNull() && !abstractNode.asText().isBlank()) {
            Map<String, String> item = new HashMap<>();
            item.put("title", getTextOrDefault(root, "Heading", "DuckDuckGo Answer"));
            item.put("link", getTextOrDefault(root, "AbstractURL", ""));
            item.put("snippet", abstractNode.asText());
            item.put("displayLink", getTextOrDefault(root, "AbstractSource", ""));
            item.put("engine", "duckduckgo-api-curl");
            item.put("source", "DuckDuckGo-API-curl");
            results.add(item);
        }

        JsonNode related = root.get("RelatedTopics");
        if (related != null && related.isArray()) {
            for (JsonNode topic : related) {
                if (results.size() >= num) break;
                JsonNode text = topic.get("Text");
                JsonNode firstUrl = topic.get("FirstURL");
                if (text == null || text.isNull() || text.asText().isBlank()) continue;
                Map<String, String> item = new HashMap<>();
                String t = text.asText();
                int dashIdx = t.indexOf(" - ");
                item.put("title", dashIdx > 0 ? t.substring(0, dashIdx).trim() : t);
                item.put("link", firstUrl != null ? firstUrl.asText() : "");
                item.put("snippet", dashIdx > 0 ? t.substring(dashIdx + 3).trim() : t);
                item.put("displayLink", extractHost(item.get("link")));
                item.put("engine", "duckduckgo-api-curl");
                item.put("source", "DuckDuckGo-API-curl");
                results.add(item);
            }
        }
        return results;
    }

    /**
     * Fetch a URL by invoking the `curl` shell command THROUGH the
     * ExecutorService — exactly the same code path as the agent's
     * execute_commands tool. The curl run shows up in the UI's execution
     * viewer (with logs, exit code, status) like any other shell command.
     *
     * We create a one-step Execution, fire it via the async execute(), poll
     * the execution status until terminal, then read the curl stdout from
     * the persisted StepResult.output. Returns cleaned text + extracted links.
     */
    private Map<String, Object> fetchAndCleanUrl(String rawUrl) {
        Map<String, Object> out = new HashMap<>();
        out.put("url", rawUrl);

        // Normalize: add https:// if no scheme.
        String url = rawUrl;
        if (!url.matches("^https?://.*")) url = "https://" + url;

        // Build the curl shell command. Quote the URL in case it has & or ?.
        //   -L          follow redirects
        //   -s -S       silent + show errors
        //   --max-time  hard timeout
        //   -A          real Chrome User-Agent (evades bot detection)
        //   -H          browser-like Accept headers
        //   --compressed accept gzip/deflate and auto-decode
        //   -o -        body to stdout
        //   -w          append "\n---HTTP_STATUS:%{http_code}---" so we can
        //               recover the HTTP status from stdout
        String curlCmd = String.format(
                "curl -L -s -S --max-time 20 " +
                "-A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' " +
                "-H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' " +
                "-H 'Accept-Language: en-US,en;q=0.9' " +
                "-H 'Accept-Encoding: gzip, deflate' " +
                "--compressed " +
                "-o - -w '\\n---HTTP_STATUS:%%{http_code}---' " +
                "'%s'",
                url.replace("'", "'\\''")
        );

        Map<String, Object> r = runCurlViaExecutor("curl fetch: " + url, curlCmd);
        out.put("executionId", r.get("executionId"));
        out.put("executionStatus", r.get("executionStatus"));
        out.put("exitCode", r.get("exitCode"));
        if (r.get("error") != null) out.put("error", r.get("error"));

        String stdout = (String) r.getOrDefault("stdout", "");

        // Split the trailing HTTP status marker curl appended.
        int status = 0;
        String body = stdout;
        int markerIdx = stdout.lastIndexOf("\n---HTTP_STATUS:");
        if (markerIdx >= 0) {
            String tail = stdout.substring(markerIdx + "\n---HTTP_STATUS:".length());
            int endIdx = tail.lastIndexOf("---");
            if (endIdx >= 0) {
                try { status = Integer.parseInt(tail.substring(0, endIdx).trim()); }
                catch (NumberFormatException ignore) {}
            }
            body = stdout.substring(0, markerIdx);
        }
        Object exitCodeObj = r.get("exitCode");
        out.put("status", status > 0 ? status : (exitCodeObj instanceof Integer i && i == 0 ? 200 : 500));

        out.put("title", extractTitle(body));
        out.put("content", cleanHtmlToText(body));
        out.put("links", extractLinks(body, url));
        log.info("curl fetch done via ExecutorService: {} -> HTTP {} ({} bytes raw, {} chars cleaned, {} links, executionId={})",
                url, out.get("status"), body.length(),
                ((String) out.get("content")).length(),
                ((java.util.List<?>) out.get("links")).size(),
                r.get("executionId"));
        return out;
    }

    /** Extract the <title>…</title> text from an HTML document. */
    private String extractTitle(String html) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(
                "(?is)<title[^>]*>(.*?)</title>").matcher(html);
        if (m.find()) {
            return decodeEntities(m.group(1).trim());
        }
        return "";
    }

    /**
     * Clean an HTML document to plain readable text. Strips <script>, <style>,
     * <head>, <noscript>, <svg>; converts block-level tags to newlines; drops
     * all remaining tags; decodes entities; collapses excess whitespace.
     * Truncates to 20_000 chars to keep LLM context budget reasonable.
     */
    private String cleanHtmlToText(String html) {
        if (html == null || html.isEmpty()) return "";
        String s = html;
        // Keep only <body> if present.
        java.util.regex.Matcher bodyM = java.util.regex.Pattern.compile(
                "(?is)<body\\b[^>]*>(.*?)</body>").matcher(s);
        if (bodyM.find()) s = bodyM.group(1);
        // Drop <script>, <style>, <noscript>, <svg>, <head> remnants.
        s = s.replaceAll("(?is)<(script|style|noscript|svg|template)\\b[^>]*>.*?</\\1>", "");
        // Convert block-level closing tags to newlines so paragraphs/lists survive.
        s = s.replaceAll("(?i)</(p|div|li|h[1-6]|tr|br|section|article|header|footer|main|aside)>", "\n");
        s = s.replaceAll("(?i)<br\\s*/?>", "\n");
        // Drop all remaining tags.
        s = s.replaceAll("<[^>]+>", "");
        // Decode common entities.
        s = decodeEntities(s);
        // Collapse runs of whitespace + blank lines.
        s = s.replaceAll("[ \\t]+", " ").replaceAll(" *\\n *", "\n").replaceAll("\\n{3,}", "\n\n");
        s = s.trim();
        // Truncate to keep the LLM context budget sane.
        if (s.length() > 20000) s = s.substring(0, 20000) + "\n\n... [truncated, " + s.length() + " total chars]";
        return s;
    }

    /**
     * Extract links from HTML. Returns a list of {text, href} maps. Resolves
     * relative links against the page URL. Skips empty/anchor-only links.
     * Limited to 50 links per page (more is noise).
     */
    private java.util.List<Map<String, String>> extractLinks(String html, String baseUrl) {
        java.util.List<Map<String, String>> links = new java.util.ArrayList<>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(
                "(?is)<a\\s[^>]*href\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</a>").matcher(html);
        java.net.URI base;
        try { base = java.net.URI.create(baseUrl); }
        catch (Exception e) { base = null; }
        int seen = 0;
        while (m.find() && seen < 50) {
            String href = m.group(1).trim();
            if (href.isEmpty() || href.startsWith("#") || href.startsWith("javascript:")
                    || href.startsWith("mailto:") || href.startsWith("data:")) continue;
            // Resolve relative URLs.
            if (base != null && !href.matches("^https?://.*")) {
                try { href = base.resolve(href).toString(); }
                catch (Exception ignore) { continue; }
            }
            String text = decodeEntities(m.group(2).replaceAll("<[^>]+>", "").trim());
            if (text.isEmpty()) text = href;
            Map<String, String> link = new HashMap<>();
            link.put("text", text);
            link.put("href", href);
            links.add(link);
            seen++;
        }
        return links;
    }

    /** Decode the common HTML entities. */
    private String decodeEntities(String s) {
        if (s == null) return "";
        return s.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&nbsp;", " ")
                .replace("&mdash;", "—")
                .replace("&ndash;", "–")
                .replace("&hellip;", "…")
                .replace("&copy;", "©")
                .replace("&trade;", "™");
    }
}