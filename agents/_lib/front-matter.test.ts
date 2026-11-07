// Why: a colon in one title or quote the model wrote used to stop a whole agent run; these pin that it is
// read, that only the front matter is touched, and that a reply YAML cannot read still fails loudly.
import { describe, expect, it } from 'vitest';
import { quoteColonValues, readFrontMatter, repairFrontMatter } from './front-matter.js';

describe('quoteColonValues', () => {
  it('quotes a colon-holding value under any key, in a list item and as a bare item', () => {
    const yaml = [
      'title: Simone Weil: attention',
      'images:',
      '  - quote: She said: look',
      '    alt: A cup, plain',
      'held:',
      '  - Step one: do it',
    ].join('\n');
    expect(quoteColonValues(yaml).split('\n')).toEqual([
      'title: "Simone Weil: attention"',
      'images:',
      '  - quote: "She said: look"',
      '    alt: A cup, plain',
      'held:',
      '  - "Step one: do it"',
    ]);
  });

  it('keeps a list item a map when its keys carry on, and makes it one string when they do not', () => {
    const yaml = ['items:', '  - Speed: slow', '  - name: Cup', '    alt: A cup'].join('\n');
    expect(quoteColonValues(yaml).split('\n')).toEqual([
      'items:',
      '  - "Speed: slow"',
      '  - name: Cup',
      '    alt: A cup',
    ]);
  });

  it('leaves plain, quoted and flow values alone', () => {
    const yaml = [
      'title: Plain title',
      'note: "Already: quoted"',
      'aliases: [a, b]',
      'url: https://x.org',
    ].join('\n');
    expect(quoteColonValues(yaml)).toBe(yaml);
  });
});

describe('readFrontMatter', () => {
  it('reads front matter that holds an unquoted colon, and keeps the body as written', () => {
    const reply = [
      '---',
      'title: Martin Heidegger: the tool and the hand',
      'verdict: pass',
      '---',
      '',
      'Body line: with a colon, never quoted.',
    ].join('\n');
    const { data, content } = readFrontMatter(reply);
    expect(data['title']).toBe('Martin Heidegger: the tool and the hand');
    expect(data['verdict']).toBe('pass');
    expect(content.trim()).toBe('Body line: with a colon, never quoted.');
  });

  it('quotes a passage YAML read as a map, when the caller wants a list of strings', () => {
    const reply = '---\nheld:\n  - My manager said: we close\n---\nBody\n';
    const strings = (data: Record<string, unknown>) =>
      Array.isArray(data['held']) && data['held'].every((h) => typeof h === 'string');
    expect(readFrontMatter(reply, strings).data['held']).toEqual(['My manager said: we close']);
  });

  it('returns text YAML already reads unchanged', () => {
    const text = '---\ntitle: Fine\n---\nBody\n';
    expect(repairFrontMatter(text)).toBe(text);
  });

  it('still throws when the front matter cannot be read even after quoting', () => {
    expect(() => readFrontMatter('---\ntitle: [unclosed\n---\nBody\n')).toThrow();
  });
});
