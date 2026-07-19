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
package dev.runner.agent.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Renders a plain-text / lightly-markdown body into a polished, responsive HTML email
 * suitable for direct sending (Gmail API / SMTP) with inline CSS. Includes a small,
 * safe markdown-to-HTML pass so headings, bold, lists, code blocks, and links render
 * correctly even when the LLM emits markdown-flavored text instead of pure plain text.
 */
public final class EmailRenderer {

    private EmailRenderer() {}

    private static final Pattern INLINE_CODE = Pattern.compile("`([^`\\n]+)`");
    private static final Pattern BOLD = Pattern.compile("\\*\\*([^*\\n]+)\\*\\*");
    private static final Pattern ITALIC = Pattern.compile("(?<![*\\w])\\*([^*\\n]+)\\*(?!\\w)");
    private static final Pattern LINK = Pattern.compile("\\[([^\\]]+)]\\((https?://[^)\\s]+)\\)");
    private static final Pattern HR = Pattern.compile("(?m)^\\s*(?:---|[*_]{3,})\\s*$");
    private static final Pattern HEADING = Pattern.compile("(?m)^(#{1,6})\\s+(.+?)\\s*#*\\s*$");
    private static final Pattern UNORDERED = Pattern.compile("(?m)^\\s*[-*+]\\s+(.+)$");
    private static final Pattern ORDERED = Pattern.compile("(?m)^\\s*(\\d+)\\.\\s+(.+)$");

    // Heuristics for "this body is already HTML" — when true, we skip the
    // markdown-to-HTML pass and pass the HTML through untouched (just wrapped
    // in our email template). Otherwise we treat the body as plain text /
    // markdown and convert it to HTML.
    private static final Pattern HTML_DOCTYPE = Pattern.compile("(?i)^\\s*<!doctype\\s+html");
    private static final Pattern HTML_ROOT = Pattern.compile("(?i)^\\s*<html[\\s>]");
    private static final Pattern HTML_BODY = Pattern.compile("(?is)<\\s*body\\b[^>]*>");
    private static final Pattern HTML_BLOCK_TAG = Pattern.compile("(?i)<(?:div|section|article|table|p|h[1-6]|ul|ol|li|pre|blockquote)\\b[^>]*>");

    /**
     * Returns true if {@code body} looks like already-rendered HTML the model
     * produced directly (rather than markdown we should convert). We detect:
     *   - starts with <!doctype html> or <html>
     *   - has a <body> tag
     *   - has 3+ distinct HTML block-level tags (heuristic — markdown wouldn't
     *     naturally contain that many)
     */
    static boolean isAlreadyHtml(String body) {
        if (body == null || body.isBlank()) return false;
        if (HTML_DOCTYPE.matcher(body).find()) return true;
        if (HTML_ROOT.matcher(body).find()) return true;
        if (HTML_BODY.matcher(body).find()) return true;
        // Count distinct block-tag openings; require 3+ for confidence.
        int count = 0;
        java.util.regex.Matcher m = HTML_BLOCK_TAG.matcher(body);
        while (m.find()) {
            count++;
            if (count >= 3) return true;
        }
        return false;
    }

    public static String renderHtml(String plainText) {
        if (plainText == null) plainText = "";
        String trimmed = plainText.trim();
        String body;
        if (isAlreadyHtml(trimmed)) {
            // The model emitted raw HTML — don't escape or markdown-process it.
            // Just strip a wrapping <html>/<head>/<body> if present so we can
            // re-wrap it in our own email template.
            body = extractInnerHtml(trimmed);
        } else {
            body = markdownToHtml(trimmed);
        }
        return wrap(body);
    }

    /** If the input is a full HTML document, extract just the inner <body>…</body>. */
    private static String extractInnerHtml(String html) {
        // Strip everything before <body> and after </body> if present.
        java.util.regex.Matcher bodyMatch = Pattern.compile("(?is)<\\s*body\\b[^>]*>(.*?)<\\s*/\\s*body\\s*>").matcher(html);
        if (bodyMatch.find()) {
            return bodyMatch.group(1).trim();
        }
        // Otherwise strip <html>/<head> wrappers but keep the rest.
        return html.replaceAll("(?is)<\\s*html\\b[^>]*>", "")
                   .replaceAll("(?is)</\\s*html\\s*>", "")
                   .replaceAll("(?is)<\\s*head\\b[^>]*>.*?<\\s*/\\s*head\\s*>", "")
                   .trim();
    }

    public static String renderPlainText(String plainText) {
        if (plainText == null) return "";
        // If the body is HTML, derive a readable plain-text version from it
        // so the multipart/alternative text part isn't full of raw tags.
        if (isAlreadyHtml(plainText)) {
            return htmlToPlainText(plainText);
        }
        return plainText;
    }

    /** Very small HTML-to-text: drop <head>, drop tags, decode a few entities, collapse whitespace. */
    static String htmlToPlainText(String html) {
        String s = html;
        // Drop <head>…</head> entirely.
        s = s.replaceAll("(?is)<\\s*head\\b[^>]*>.*?<\\s*/\\s*head\\s*>", "");
        // Drop <style> and <script> blocks.
        s = s.replaceAll("(?is)<\\s*(style|script)\\b[^>]*>.*?<\\s*/\\s*\\1\\s*>", "");
        // Replace block-level tags with newlines so paragraphs/lists survive.
        s = s.replaceAll("(?i)</(p|div|li|h[1-6]|tr|br|section|article)>", "\n");
        s = s.replaceAll("(?i)<br\\s*/?>", "\n");
        // Strip all remaining tags.
        s = s.replaceAll("<[^>]+>", "");
        // Decode the common entities.
        s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ");
        // Collapse runs of blank lines.
        s = s.replaceAll("\\s*\\n\\s*\\n\\s*", "\n\n");
        return s.trim();
    }

    static String markdownToHtml(String md) {
        StringBuilder out = new StringBuilder();
        String[] lines = md.split("\\R", -1);

        int i = 0;
        while (i < lines.length) {
            String line = lines[i];

            // Fenced code block
            if (line.trim().startsWith("```")) {
                int j = i + 1;
                StringBuilder code = new StringBuilder();
                while (j < lines.length && !lines[j].trim().startsWith("```")) {
                    code.append(lines[j]).append('\n');
                    j++;
                }
                out.append("<pre style=\"margin:16px 0;padding:14px 16px;background:#0f1115;"
                        + "border:1px solid #232a36;border-radius:8px;overflow-x:auto;"
                        + "font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;"
                        + "font-size:13px;line-height:1.55;color:#e6edf3;white-space:pre;\">")
                        .append(escapeHtml(code.toString().replaceAll("\\n$", "")))
                        .append("</pre>");
                i = (j < lines.length) ? j + 1 : j;
                continue;
            }

            // Horizontal rule
            if (HR.matcher(line).matches()) {
                out.append("<hr style=\"border:none;border-top:1px solid #e6e6e6;margin:24px 0;\"/>");
                i++;
                continue;
            }

            // Heading
            Matcher h = HEADING.matcher(line);
            if (h.matches()) {
                int level = h.group(1).length();
                String text = inline(h.group(2));
                out.append("<h").append(level).append(" style=\"").append(headingStyle(level)).append("\">")
                        .append(text).append("</h").append(level).append(">");
                i++;
                continue;
            }

            // Blockquote (collect contiguous lines)
            if (line.startsWith(">")) {
                StringBuilder q = new StringBuilder();
                while (i < lines.length && lines[i].startsWith(">")) {
                    q.append(lines[i].replaceFirst("^>\\s?", "")).append('\n');
                    i++;
                }
                out.append("<blockquote style=\"margin:14px 0;padding:10px 16px;"
                        + "border-left:4px solid #00fff2;background:#f7fbfc;color:#344054;\">")
                        .append(inline(q.toString().trim().replace("\n", "<br/>")))
                        .append("</blockquote>");
                continue;
            }

            // Unordered list
            if (UNORDERED.matcher(line).matches()) {
                out.append("<ul style=\"margin:12px 0 12px 20px;padding:0;\">");
                while (i < lines.length) {
                    Matcher m = UNORDERED.matcher(lines[i]);
                    if (!m.matches()) break;
                    out.append("<li style=\"margin:6px 0;line-height:1.55;\">")
                            .append(inline(m.group(1))).append("</li>");
                    i++;
                }
                out.append("</ul>");
                continue;
            }

            // Ordered list
            if (ORDERED.matcher(line).matches()) {
                out.append("<ol style=\"margin:12px 0 12px 24px;padding:0;\">");
                while (i < lines.length) {
                    Matcher m = ORDERED.matcher(lines[i]);
                    if (!m.matches()) break;
                    out.append("<li style=\"margin:6px 0;line-height:1.55;\">")
                            .append(inline(m.group(2))).append("</li>");
                    i++;
                }
                out.append("</ol>");
                continue;
            }

            // Blank line = paragraph break
            if (line.trim().isEmpty()) {
                out.append('\n');
                i++;
                continue;
            }

            // Paragraph: collect until blank line or block element
            StringBuilder para = new StringBuilder();
            while (i < lines.length && !lines[i].trim().isEmpty()
                    && !HEADING.matcher(lines[i]).matches()
                    && !HR.matcher(lines[i]).matches()
                    && !UNORDERED.matcher(lines[i]).matches()
                    && !ORDERED.matcher(lines[i]).matches()
                    && !lines[i].startsWith(">")
                    && !lines[i].trim().startsWith("```")) {
                if (para.length() > 0) para.append("<br/>");
                para.append(inline(lines[i]));
                i++;
            }
            if (para.length() > 0) {
                out.append("<p style=\"margin:0 0 14px 0;line-height:1.6;color:#1f2937;\">")
                        .append(para).append("</p>");
            }
        }

        return out.toString();
    }

    /** Inline transforms: bold, italic, code, links, escape. */
    static String inline(String text) {
        if (text == null || text.isEmpty()) return "";
        String s = escapeHtml(text);

        // Inline code first so its content isn't markdown-processed further.
        s = INLINE_CODE.matcher(s).replaceAll(
                "<code style=\"background:#eef1f4;padding:1px 6px;border-radius:4px;"
                        + "font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;"
                        + "font-size:0.92em;color:#0b1220;\">$1</code>");

        // Bold
        s = BOLD.matcher(s).replaceAll("<strong style=\"color:#0b1220;\">$1</strong>");
        // Italic
        s = ITALIC.matcher(s).replaceAll("<em>$1</em>");
        // Links
        s = LINK.matcher(s).replaceAll(
                "<a href=\"$2\" style=\"color:#0e7c86;text-decoration:underline;"
                        + "font-weight:500;\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>");
        return s;
    }

    private static String headingStyle(int level) {
        String size;
        switch (level) {
            case 1 -> size = "26px";
            case 2 -> size = "22px";
            case 3 -> size = "18px";
            case 4 -> size = "16px";
            case 5 -> size = "14px";
            default -> size = "13px";
        }
        String margin = level <= 2 ? "22px 0 12px 0" : "16px 0 8px 0";
        return "margin:" + margin + ";font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"
                + "font-size:" + size + ";font-weight:700;line-height:1.25;color:#0b1220;"
                + "letter-spacing:-0.01em;";
    }

    private static String escapeHtml(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String wrap(String bodyHtml) {
        StringBuilder sb = new StringBuilder(2048 + bodyHtml.length());
        sb.append("<!doctype html><html lang=\"en\"><head>")
          .append("<meta charset=\"utf-8\"/>")
          .append("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>")
          .append("<meta name=\"x-apple-disable-message-reformatting\"/>")
          .append("<title>Email</title></head>")
          .append("<body style=\"margin:0;padding:0;background:#f4f6f8;-webkit-text-size-adjust:100%;\">")
          .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f6f8;\"><tr>")
          .append("<td align=\"center\" style=\"padding:32px 16px;\">")
          .append("<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;background:#ffffff;border:1px solid #e6e8eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,0.04);\">")
          .append("<tr><td style=\"padding:20px 28px;background:linear-gradient(90deg,#0b1220 0%,#0e7c86 100%);color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;\">")
          .append("<div style=\"font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9be7ee;font-weight:700;\">RUNNER AGENT</div>")
          .append("<div style=\"font-size:20px;font-weight:600;margin-top:4px;letter-spacing:-0.01em;\">Delivery</div>")
          .append("</td></tr>")
          .append("<tr><td style=\"padding:28px 28px 8px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#1f2937;\">")
          .append(bodyHtml)
          .append("</td></tr>")
          .append("<tr><td style=\"padding:16px 28px 28px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;\">")
          .append("<hr style=\"border:none;border-top:1px solid #eef0f3;margin:0 0 14px 0;\"/>")
          .append("Sent by Runner Agent. If this message wasn't intended for you, please disregard.")
          .append("</td></tr></table>")
          .append("<div style=\"font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#9aa3af;margin-top:14px;\">&copy; Runner Agent</div>")
          .append("</td></tr></table>")
          .append("</body></html>");
        return sb.toString();
    }
}
