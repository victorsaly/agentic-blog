// Why: the reader's side of the chat. It answers a question from the published posts, or from the one post
// the reader is on, with the earlier turns the reader's own page sends back, and keeps nothing: no question,
// answer or address is stored or logged. It is closed until the site is public (the corpus
// says so), except in local development; a per-visitor burst limit runs in Cloudflare's memory, and the
// spend cap lives on the Anthropic key itself.
import Anthropic from '@anthropic-ai/sdk';
import {
  conversation,
  corpusFor,
  readAnswer,
  readQuestion,
  systemPrompt,
  type Corpus,
} from '../src/lib/ask';
import { json, problem, type Handler } from './_lib';

function isCorpus(data: unknown): data is Corpus {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { posts?: unknown }).posts) &&
    typeof (data as { model?: unknown }).model === 'string'
  );
}

export const onRequestPost: Handler = async ({ request, env }) => {
  const corpusResponse = await env.ASSETS.fetch(new URL('/ask-corpus.json', request.url));
  const corpus: unknown = corpusResponse.ok ? await corpusResponse.json() : null;
  if (!isCorpus(corpus)) return problem('The chat has nothing to read yet.', 503);
  if (!corpus.open && env.DEV_SKIP_ACCESS !== '1')
    return problem('The chat opens when the blog does.', 404);
  if (!env.ANTHROPIC_API_KEY) return problem('The chat is not set up on this deployment.', 503);

  const visitor = request.headers.get('cf-connecting-ip') ?? 'local';
  if (env.CHAT_LIMIT && !(await env.CHAT_LIMIT.limit({ key: visitor })).success)
    return problem('That is a lot of questions at once. Wait a minute and ask again.', 429);

  const asked = readQuestion(await request.json().catch(() => null));
  if (!asked.ok) return problem(asked.error, 400);
  const scoped = corpusFor(corpus, asked.post);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: corpus.model,
      max_tokens: 1200,
      system: [{ type: 'text', text: systemPrompt(scoped), cache_control: { type: 'ephemeral' } }],
      messages: conversation(asked),
    });
    if ((response.stop_reason as string) === 'refusal')
      return json({ answer: 'I cannot answer that one. Try asking about a post.', sources: [] });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return json(readAnswer(text, scoped));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError)
      return problem('The chat is busy. Try again in a minute.', 429);
    if (error instanceof Anthropic.APIError)
      return problem('The chat could not answer just now. Try again later.', 502);
    throw error;
  }
};
