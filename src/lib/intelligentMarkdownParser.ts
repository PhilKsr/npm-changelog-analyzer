import { marked } from 'marked';

export interface ParsedMarkdown {
  html: string;
  plainText: string;
  structure: MarkdownStructure;
  links: ExtractedLink[];
  references: ExtractedReference[];
  codeBlocks: CodeBlock[];
  lists: ParsedList[];
}

export interface MarkdownStructure {
  headers: HeaderNode[];
  sections: Section[];
}

export interface HeaderNode {
  level: number;
  text: string;
  id?: string;
  line: number;
}

export interface Section {
  header: HeaderNode;
  content: string;
  subsections: Section[];
}

export interface ExtractedLink {
  text: string;
  url: string;
  type: 'external' | 'internal' | 'anchor';
  title?: string;
}

export interface ExtractedReference {
  type: 'issue' | 'pull_request' | 'commit' | 'user' | 'repository';
  value: string;
  url?: string;
  platform: 'github' | 'gitlab' | 'bitbucket' | 'generic';
  context: string;
}

export interface CodeBlock {
  language?: string;
  code: string;
  inline: boolean;
}

export interface ParsedList {
  type: 'ordered' | 'unordered';
  items: ListItem[];
  nested: boolean;
}

export interface ListItem {
  text: string;
  checked?: boolean;
  subitems: ListItem[];
  references: ExtractedReference[];
}

export class IntelligentMarkdownParser {
  private repositoryInfo?: { owner: string; repo: string; platform: string };

  constructor(repositoryInfo?: { owner: string; repo: string; platform: string }) {
    this.repositoryInfo = repositoryInfo;
  }

  async parse(markdown: string): Promise<ParsedMarkdown> {
    const structure = this.parseStructure(markdown);
    const links = this.extractLinks(markdown);
    const references = this.extractReferences(markdown);
    const codeBlocks = this.extractCodeBlocks(markdown);
    const lists = this.parseLists(markdown);

    const renderer = this.createCustomRenderer();
    const html = await marked(markdown, { renderer });
    const plainText = this.stripMarkdown(markdown);

    return {
      html,
      plainText,
      structure,
      links,
      references,
      codeBlocks,
      lists,
    };
  }

  private parseStructure(markdown: string): MarkdownStructure {
    const lines = markdown.split('\n');
    const headers: HeaderNode[] = [];
    
    lines.forEach((line, index) => {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2].trim();
        const id = this.generateHeaderId(text);
        
        headers.push({
          level,
          text,
          id,
          line: index + 1,
        });
      }
    });

    const sections = this.buildSectionTree(headers, lines);

    return { headers, sections };
  }

  private buildSectionTree(headers: HeaderNode[], lines: string[]): Section[] {
    const sections: Section[] = [];
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const nextHeader = headers[i + 1];
      
      const startLine = header.line;
      const endLine = nextHeader ? nextHeader.line - 1 : lines.length;
      
      const content = lines
        .slice(startLine, endLine)
        .join('\n')
        .trim();

      const subsections = this.findSubsections(header, headers.slice(i + 1));

      sections.push({
        header,
        content,
        subsections,
      });
    }

    return sections;
  }

  private findSubsections(parentHeader: HeaderNode, remainingHeaders: HeaderNode[]): Section[] {
    const subsections: Section[] = [];
    
    for (const header of remainingHeaders) {
      if (header.level <= parentHeader.level) break;
      if (header.level === parentHeader.level + 1) {
        subsections.push({
          header,
          content: '',
          subsections: [],
        });
      }
    }

    return subsections;
  }

  private extractLinks(markdown: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    
    const linkPatterns = [
      // [text](url "title")
      /\[([^\]]+)\]\(([^)]+?)(?:\s+"([^"]+)")?\)/g,
      // [text][ref] and [ref]: url
      /\[([^\]]+)\]\[([^\]]+)\]/g,
      // <url>
      /<(https?:\/\/[^>]+)>/g,
      // bare URLs
      /(?:^|\s)(https?:\/\/[^\s\)]+)/g,
    ];

    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(markdown)) !== null) {
        const text = match[1] || match[2] || match[1];
        const url = match[2] || match[1];
        const title = match[3];
        
        if (url) {
          links.push({
            text: text || url,
            url,
            title,
            type: this.classifyLinkType(url),
          });
        }
      }
    }

    return this.deduplicateLinks(links);
  }

  private extractReferences(markdown: string): ExtractedReference[] {
    const references: ExtractedReference[] = [];
    
    const patterns = [
      // GitHub/GitLab issues and PRs
      {
        regex: /(?:^|\s)#(\d+)(?=\s|$|[^\w])/g,
        type: 'issue' as const,
        platform: 'github' as const,
      },
      {
        regex: /(?:^|\s)(?:PR|pull request|merge request)\s*#?(\d+)(?=\s|$|[^\w])/gi,
        type: 'pull_request' as const,
        platform: 'github' as const,
      },
      // Cross-repository references
      {
        regex: /([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)/g,
        type: 'issue' as const,
        platform: 'github' as const,
      },
      // Commit hashes
      {
        regex: /(?:^|\s)([a-f0-9]{7,40})(?=\s|$)/g,
        type: 'commit' as const,
        platform: 'github' as const,
      },
      // User mentions
      {
        regex: /@([a-zA-Z0-9_-]+)/g,
        type: 'user' as const,
        platform: 'github' as const,
      },
      // Repository mentions
      {
        regex: /(?:^|\s)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)(?=\s|$)/g,
        type: 'repository' as const,
        platform: 'github' as const,
      },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(markdown)) !== null) {
        const value = match[1] + (match[2] ? `#${match[2]}` : '');
        const context = this.extractContext(markdown, match.index, 50);
        const url = this.generateReferenceUrl(pattern.type, value, pattern.platform);
        
        references.push({
          type: pattern.type,
          value,
          url,
          platform: pattern.platform,
          context,
        });
      }
    }

    return this.deduplicateReferences(references);
  }

  private extractCodeBlocks(markdown: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    
    // Fenced code blocks
    const fencedRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
    let match;
    while ((match = fencedRegex.exec(markdown)) !== null) {
      codeBlocks.push({
        language: match[1],
        code: match[2],
        inline: false,
      });
    }

    // Inline code
    const inlineRegex = /`([^`]+)`/g;
    while ((match = inlineRegex.exec(markdown)) !== null) {
      codeBlocks.push({
        code: match[1],
        inline: true,
      });
    }

    return codeBlocks;
  }

  private parseLists(markdown: string): ParsedList[] {
    const lists: ParsedList[] = [];
    const lines = markdown.split('\n');
    
    let currentList: ParsedList | null = null;
    let currentIndent = 0;

    for (const line of lines) {
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      
      if (listMatch) {
        const indent = listMatch[1].length;
        const marker = listMatch[2];
        const text = listMatch[3];
        const isOrdered = /\d+\./.test(marker);
        const isChecked = text.startsWith('[ ]') || text.startsWith('[x]');
        
        if (!currentList || currentList.type !== (isOrdered ? 'ordered' : 'unordered')) {
          currentList = {
            type: isOrdered ? 'ordered' : 'unordered',
            items: [],
            nested: indent > 0,
          };
          lists.push(currentList);
        }

        const references = this.extractReferences(text);
        const cleanText = text.replace(/^\[[ x]\]\s*/, '');

        currentList.items.push({
          text: cleanText,
          checked: isChecked ? text.startsWith('[x]') : undefined,
          subitems: [],
          references,
        });

        // currentIndent = indent;
      } else if (line.trim() === '') {
        currentList = null;
        currentIndent = 0;
      }
    }

    return lists;
  }

  private classifyLinkType(url: string): 'external' | 'internal' | 'anchor' {
    if (url.startsWith('#')) return 'anchor';
    if (url.startsWith('http://') || url.startsWith('https://')) return 'external';
    return 'internal';
  }

  private generateHeaderId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  private generateReferenceUrl(
    type: ExtractedReference['type'],
    value: string,
    platform: string
  ): string | undefined {
    if (!this.repositoryInfo || platform !== 'github') return undefined;

    const { owner, repo } = this.repositoryInfo;
    const baseUrl = `https://github.com/${owner}/${repo}`;

    switch (type) {
      case 'issue':
        if (value.includes('/')) {
          const [repoPath, issueNum] = value.split('#');
          return `https://github.com/${repoPath}/issues/${issueNum}`;
        }
        return `${baseUrl}/issues/${value}`;
      
      case 'pull_request':
        if (value.includes('/')) {
          const [repoPath, prNum] = value.split('#');
          return `https://github.com/${repoPath}/pull/${prNum}`;
        }
        return `${baseUrl}/pull/${value}`;
      
      case 'commit':
        return `${baseUrl}/commit/${value}`;
      
      case 'user':
        return `https://github.com/${value}`;
      
      case 'repository':
        return `https://github.com/${value}`;
      
      default:
        return undefined;
    }
  }

  private extractContext(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.slice(start, end).trim();
  }

  private createCustomRenderer() {
    const renderer = new marked.Renderer();
    
    renderer.link = ({ href, title, tokens }) => {
      const text = tokens?.[0]?.raw || href;
      const titleAttr = title ? ` title="${title}"` : '';
      const target = href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
    };

    renderer.code = ({ text, lang }) => {
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langClass}>${text}</code></pre>`;
    };

    return renderer;
  }

  private stripMarkdown(markdown: string): string {
    return markdown
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      .replace(/^#{1,6}\s+/gm, '') // Headers
      .replace(/^\s*[-*+]\s+/gm, '') // Unordered lists
      .replace(/^\s*\d+\.\s+/gm, '') // Ordered lists
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/~~([^~]+)~~/g, '$1') // Strikethrough
      .replace(/^\s*>\s+/gm, '') // Blockquotes
      .replace(/^\s*---+\s*$/gm, '') // Horizontal rules
      .replace(/\n\s*\n/g, '\n') // Multiple newlines
      .trim();
  }

  private deduplicateLinks(links: ExtractedLink[]): ExtractedLink[] {
    const seen = new Set<string>();
    return links.filter(link => {
      const key = `${link.url}|${link.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateReferences(references: ExtractedReference[]): ExtractedReference[] {
    const seen = new Set<string>();
    return references.filter(ref => {
      const key = `${ref.type}|${ref.value}|${ref.platform}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}