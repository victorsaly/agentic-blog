// Why: which provider a node runs on decides where its data goes and what it costs. That rule lives here
// once, so validate (the data rules) and plan (where data goes) can never disagree about it, and a fallback
// provider is counted wherever the primary one is.
import type { Node } from './schema.js';

type CardNode = Extract<Node, { kind: 'agent' | 'guard' }>;

/** The provider a node normally runs on: its own setting, or its card's default. */
export function providerOf(n: Node): string | undefined {
  if (n.kind !== 'agent' && n.kind !== 'guard') return undefined;
  return n.provider ?? n.card.model.default;
}

/** Every provider a node may send data to: the one it runs on, then its fallback when it has one. */
export function providersOf(n: CardNode): string[] {
  const primary = n.provider ?? n.card.model.default;
  const b = n.card.behaviour;
  const fallback = b.onFailure === 'use-fallback' ? b.fallback : undefined;
  return fallback !== undefined && fallback !== primary ? [primary, fallback] : [primary];
}
