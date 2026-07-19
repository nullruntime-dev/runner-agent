import chalk from 'chalk';

/**
 * Terminal markdown renderer
 * Handles AI output that may lack proper line breaks
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';

  // Step 1: Extract and protect code blocks
  // Known language tags to detect
  const knownLangs = ['java', 'python', 'py', 'javascript', 'js', 'typescript', 'ts', 'go', 'rust', 'c', 'cpp', 'csharp', 'cs', 'ruby', 'rb', 'php', 'swift', 'kotlin', 'scala', 'bash', 'sh', 'shell', 'sql', 'html', 'css', 'json', 'yaml', 'yml', 'xml', 'markdown', 'md', 'text', 'txt', 'plaintext'];

  const codeBlocks: string[] = [];
  let result = text.replace(/```([\s\S]*?)```/g, (match, content) => {
    const idx = codeBlocks.length;

    // Try to extract language from start of content
    let lang = '';
    let code = content;

    // Check if content starts with a known language name
    const contentLower = content.toLowerCase();

    // Common code starters for different languages
    const codeStarters: Record<string, RegExp> = {
      python: /^(def |class |import |from |print\(|if |for |while |#|@|"""|')/i,
      py: /^(def |class |import |from |print\(|if |for |while |#|@|"""|')/i,
      java: /^(public |private |protected |class |import |package |@|\/\/|\/\*|static )/i,
      javascript: /^(function |const |let |var |import |export |class |\/\/|\/\*|async |await )/i,
      js: /^(function |const |let |var |import |export |class |\/\/|\/\*|async |await )/i,
      typescript: /^(function |const |let |var |import |export |class |interface |type |\/\/|\/\*|async |await )/i,
      ts: /^(function |const |let |var |import |export |class |interface |type |\/\/|\/\*|async |await )/i,
      go: /^(package |import |func |type |var |const |\/\/|\/\*)/i,
      rust: /^(fn |pub |use |mod |struct |impl |let |const |\/\/|\/\*)/i,
      bash: /^(#!|echo |if |for |while |\$|export |cd |ls |cat |grep )/i,
      sh: /^(#!|echo |if |for |while |\$|export |cd |ls |cat |grep )/i,
      sql: /^(SELECT |INSERT |UPDATE |DELETE |CREATE |DROP |ALTER |FROM |WHERE )/i,
      text: /^./,  // Text matches anything
      txt: /^./,
      plaintext: /^./,
    };

    for (const knownLang of knownLangs) {
      if (contentLower.startsWith(knownLang)) {
        const rest = content.slice(knownLang.length);
        const nextChar = rest[0];

        // If followed by whitespace or newline, it's definitely the language
        if (!nextChar || /[\s\n]/.test(nextChar)) {
          lang = knownLang;
          code = rest;
          break;
        }

        // If followed by code that matches the language's patterns, it's the language
        const pattern = codeStarters[knownLang];
        if (pattern && pattern.test(rest)) {
          lang = knownLang;
          code = rest;
          break;
        }
      }
    }

    // Clean up code
    let cleanCode = code.trim();

    // If no newlines or very few, try to add breaks at code boundaries
    const lineCount = (cleanCode.match(/\n/g) || []).length;
    if (lineCount < 3 && cleanCode.length > 30) {
      // Language-specific formatting
      if (lang === 'python' || lang === 'py') {
        cleanCode = cleanCode
          // Put common statements on new lines
          .replace(/([^\n])(def |class |if |elif |else:|for |while |return |yield |import |from |print\(|#)/g, '$1\n$2')
          // Indent after colons
          .replace(/:\s*([a-z_\[])/gi, ':\n    $1')
          // Handle assignments after yield/return
          .replace(/(yield [^,\n]+|return [^,\n]+)([a-z_])/gi, '$1\n$2');
      } else {
        // C-style languages (Java, JS, etc.)
        cleanCode = cleanCode
          .replace(/;\s*(?=[a-zA-Z_\}])/g, ';\n')      // After semicolons
          .replace(/\}\s*\}/g, '}\n}')                 // Separate consecutive closing braces
          .replace(/\}\s*(?=[a-zA-Z_@])/g, '}\n')      // After closing braces before code
          .replace(/\{\s*(?=[a-zA-Z_])/g, '{\n  ')     // After opening braces
          .replace(/\)\s*\{/g, ') {');                 // Normalize `) {`
      }
    }

    const lines = cleanCode.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
    const langLabel = lang || 'code';

    const formatted = '\n' + chalk.bgGray.white(' ' + langLabel + ' ') + '\n' +
      lines.map((line: string) => chalk.gray('  │ ') + chalk.white(line)).join('\n') + '\n';
    codeBlocks.push(formatted);
    return `\x00CB${idx}\x00`;
  });

  // Step 2: Normalize whitespace - collapse multiple spaces, normalize line endings
  result = result.replace(/\r\n/g, '\n');
  result = result.replace(/[ \t]+/g, ' ');

  // Step 3: Insert line breaks before structural elements
  // Before headers (##, #, ###)
  result = result.replace(/([.!?:"\)a-z0-9])(\s*)(#{1,3})\s+/g, '$1\n\n$3 ');

  // Break after colon followed by bold (common "Why it's popular:**" pattern)
  result = result.replace(/:(\*\*)/g, ':\n$1');

  // Break after **text:** patterns
  result = result.replace(/(\*\*[^*]+:\*\*)\s*/g, '$1\n');

  // Before list items (- or *)
  result = result.replace(/([.!?:"\)a-z0-9])(\s*)[-*]\s+(?=\*\*|\[)/g, '$1\n- ');
  result = result.replace(/(\*\*)(\s*)[-*]\s+/g, '$1\n- ');

  // Before numbered lists with capital letter or bold
  result = result.replace(/([.!?:"\)a-z0-9])(\s*)(\d+)\.\s+(?=[A-Z\*\[])/g, '$1\n\n$3. ');

  // Handle emoji followed by lists (common pattern)
  result = result.replace(/([\u{1F300}-\u{1F9FF}])(\s*)(\d+)\.\s+/gu, '$1\n\n$3. ');
  result = result.replace(/([\u{1F300}-\u{1F9FF}])(\s*)[-*]\s+/gu, '$1\n- ');

  // Step 4: Process line by line for clean output
  const lines = result.split('\n');
  const processed: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      // Keep empty lines for spacing, but not too many
      if (processed.length > 0 && processed[processed.length - 1] !== '') {
        processed.push('');
      }
      continue;
    }

    // Headers
    if (line.match(/^###\s+(.+)/)) {
      const match = line.match(/^###\s+(.+)/);
      if (match) {
        if (processed.length > 0) processed.push('');
        processed.push(chalk.bold.blue('  ▸ ' + match[1]));
        continue;
      }
    }
    if (line.match(/^##\s+(.+)/)) {
      const match = line.match(/^##\s+(.+)/);
      if (match) {
        if (processed.length > 0) processed.push('');
        processed.push(chalk.bold.cyan('▸ ' + match[1]));
        continue;
      }
    }
    if (line.match(/^#\s+(.+)/)) {
      const match = line.match(/^#\s+(.+)/);
      if (match) {
        if (processed.length > 0) processed.push('');
        processed.push(chalk.bold.magenta('▸ ' + match[1]));
        continue;
      }
    }

    // Unordered list items
    if (line.match(/^[-*]\s+(.+)/)) {
      const match = line.match(/^[-*]\s+(.+)/);
      if (match) {
        processed.push(chalk.cyan('  • ') + formatInline(match[1]));
        continue;
      }
    }

    // Numbered list items
    if (line.match(/^(\d+)\.\s+(.+)/)) {
      const match = line.match(/^(\d+)\.\s+(.+)/);
      if (match) {
        processed.push(chalk.cyan('  ' + match[1] + '. ') + formatInline(match[2]));
        continue;
      }
    }

    // Regular paragraph
    processed.push(formatInline(line));
  }

  result = processed.join('\n');

  // Step 5: Restore code blocks
  codeBlocks.forEach((block, idx) => {
    result = result.replace(`\x00CB${idx}\x00`, block);
  });

  // Step 6: Final cleanup - max 2 consecutive empty lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Format inline elements: bold, italic, code, links
 */
function formatInline(text: string): string {
  let result = text;

  // Inline code (before bold/italic to avoid conflicts)
  result = result.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, t) => chalk.bold(t));

  // Italic (single asterisk, but not inside words)
  result = result.replace(/(?<![a-zA-Z])\*([^*]+)\*(?![a-zA-Z])/g, (_, t) => chalk.italic(t));

  // Links [text](url) -> text (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) =>
    chalk.underline(linkText) + chalk.gray(' (' + url + ')')
  );

  return result;
}

// Strip markdown for plain text
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s*/gm, '')
    .trim();
}
