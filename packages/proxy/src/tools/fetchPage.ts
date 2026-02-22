import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface PageContent {
  title: string;
  content: string;
  text_content: string;
  excerpt: string;
  byline: string;
  length: number;
  mime_type: string;
}

export async function fetchPage(url: string): Promise<PageContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIInterface/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  // Non-HTML: return raw content
  if (!contentType.includes('html')) {
    return {
      title: url,
      content: body.slice(0, 50_000),
      text_content: body.slice(0, 50_000),
      excerpt: body.slice(0, 200),
      byline: '',
      length: body.length,
      mime_type: contentType.split(';')[0].trim(),
    };
  }

  // HTML: extract with Readability
  const dom = new JSDOM(body, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    return {
      title: dom.window.document.title || url,
      content: body.slice(0, 50_000),
      text_content: dom.window.document.body?.textContent?.slice(0, 50_000) || '',
      excerpt: '',
      byline: '',
      length: body.length,
      mime_type: 'text/html',
    };
  }

  return {
    title: article.title,
    content: article.content.slice(0, 50_000),
    text_content: article.textContent.slice(0, 50_000),
    excerpt: article.excerpt || '',
    byline: article.byline || '',
    length: article.length,
    mime_type: 'text/html',
  };
}
