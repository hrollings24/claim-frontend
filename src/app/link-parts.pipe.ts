import { Pipe, PipeTransform } from '@angular/core';

/** A run of text, and the address it links to if it's a link. */
export interface TextPart {
  text: string;
  href: string | null;
}

/** http(s) addresses, up to the next space. A fresh copy is made per call, since a global regex keeps state. */
const URL_PATTERN = /https?:\/\/[^\s]+/;

/** Punctuation that ends a sentence rather than the address — "see https://x.com." */
const TRAILING = /[.,;:!?)\]'"]+$/;

/**
 * Splits text written by players into plain runs and links, so a challenge can point at a map
 * or a page. The template renders the parts itself rather than setting innerHTML, so nothing in
 * the text can ever become markup beyond a plain link.
 */
@Pipe({ name: 'linkParts', standalone: true })
export class LinkPartsPipe implements PipeTransform {
  transform(text: string | null | undefined): TextPart[] {
    if (!text) {
      return [];
    }

    const parts: TextPart[] = [];
    const pattern = new RegExp(URL_PATTERN.source, 'g');
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const url = match[0].replace(TRAILING, '');

      if (start > last) {
        parts.push({ text: text.slice(last, start), href: null });
      }

      parts.push({ text: url, href: url });
      last = start + url.length;
    }

    if (last < text.length) {
      parts.push({ text: text.slice(last), href: null });
    }

    return parts;
  }
}
