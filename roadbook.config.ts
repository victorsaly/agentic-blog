// Why: the whole blog, described for Agentic Roadbook in one file, the way a Bicep file describes an Azure
// deployment. `npm run roadbook -- validate` checks it against every accountability rule; `npm run
// roadbook -- plan` says in plain words what it will do, send, cost and create. Today the gates are the
// pull request reviews Victor already does; the live studio will open the same gates on its canvas.
import { claude, defineProject, githubPullRequest, openaiImages, workersAi } from '@roadbook/core';
import { card as citations } from './agents/citations/card.js';
import { card as convert } from './agents/convert/card.js';
import { card as diagram } from './agents/diagram/card.js';
import { card as drilldown } from './agents/drilldown/card.js';
import { card as image } from './agents/image/card.js';
import { card as interview } from './agents/interview/card.js';
import { card as publish } from './agents/publish/card.js';
import { card as safety } from './agents/safety/card.js';
import { card as security } from './agents/security/card.js';
import { card as seo } from './agents/seo/card.js';
import { card as structure } from './agents/structure/card.js';

export default defineProject({
  name: 'agentic-blog',
  why: 'A blog where every post starts as a real thought, kept exactly as it came out, and every version links back to it.',
  owner: { name: 'Victor Saly', email: 'info@victorsaly.com' },

  accountability: {
    disclosure: { left: 'AI version', right: 'Original' },
    replay: 'per-item',
    overrideNeedsReason: true,
  },

  data: {
    host: 'owner-account',
    // R2's default location. Set an EU jurisdiction on the bucket and change this to 'eu' to pin it.
    home: 'global',
    // The posts are public once merged, so processing them in the US is accepted for this project. A client
    // project would narrow this to ['uk'] and use providers deployed there.
    allowedRegions: ['uk', 'eu', 'us', 'global'],
    personalData: 'hold-for-review',
    exits: {
      writer: {
        sends: ['text', 'metadata', 'prompt', 'image'],
        region: 'us',
        retention: 'provider-default',
        why: 'Claude receives the origin and drafts to tidy them, and each finished drawing to review it against its prompt. Retention follows Anthropic’s API terms.',
      },
      images: {
        sends: ['prompt', 'image'],
        region: 'us',
        retention: 'provider-default',
        why: 'OpenAI receives the drawing prompt and, on Victor’s machine only, his reference photo to draw from.',
      },
      workers: {
        sends: ['audio', 'prompt'],
        region: 'global',
        retention: 'provider-default',
        why: 'Workers AI transcribes the studio recordings and draws the fallback prints, inside Victor’s Cloudflare account.',
      },
    },
  },

  providers: {
    writer: claude({ model: 'claude-sonnet-5-5' }),
    images: openaiImages(),
    workers: workersAi({ model: '@cf/openai/whisper-large-v3-turbo' }),
  },

  budget: { monthlyCapUsd: 30, atCap: 'queue' },

  flow: {
    capacity: {
      answers: { perDay: 5 },
      message: { perDay: 2 },
      merge: { perDay: 2 },
    },
    release: { cadence: 'daily 08:00', maxPerDay: 1, spreadThemes: '7d' },
    prepareAhead: '3d',
    categories: {
      'ai-changing-work': { importance: 'high' },
      accountability: { importance: 'high' },
      credibility: { importance: 'medium' },
      'scalable-secure': { importance: 'medium' },
      'apps-and-workflows': { importance: 'low' },
    },
  },

  workflows: [
    {
      id: 'blog-post',
      why: 'One thought, from the moment it is said to the moment it is published, with Victor deciding at each gate.',
      nodes: {
        origin: {
          kind: 'input',
          why: 'Where every post starts: a voice note from the studio, or a note written and pasted.',
          accepts: ['audio', 'text'],
        },
        transcribe: {
          kind: 'tool',
          why: 'Turns a recording into words without changing them; the recording stays as the true origin.',
          after: ['origin'],
          does: 'Workers AI Whisper, with word timestamps; skipped for written notes.',
        },
        interview: {
          kind: 'agent',
          why: 'Asks what a stranger would need to know before anything is written.',
          after: ['transcribe'],
          card: interview,
        },
        answers: {
          kind: 'gate',
          why: 'Only Victor knows where he was and what he meant; the agent waits for him.',
          after: ['interview'],
          asks: 'answer',
          question: 'Answer the questions a reader would ask.',
        },
        structure: {
          kind: 'agent',
          why: 'Finds the point and the small ideas, so everything after has a shape to follow.',
          after: ['answers'],
          card: structure,
        },
        message: {
          kind: 'gate',
          why: 'If the message is wrong, every version built on it is wrong; Victor approves it first.',
          after: ['structure'],
          asks: 'approve',
          question: 'Is this the message?',
        },
        convert: {
          kind: 'agent',
          why: 'Writes the versions a reader takes in.',
          after: ['message'],
          card: convert,
        },
        image: {
          kind: 'agent',
          why: 'Draws the prints that carry the mood, in the house style.',
          after: ['message'],
          card: image,
        },
        diagram: {
          kind: 'agent',
          why: 'Draws a process as boxes where that reads faster than prose.',
          after: ['convert'],
          card: diagram,
        },
        citations: {
          kind: 'agent',
          why: 'Gives every claim a door out.',
          after: ['convert'],
          card: citations,
        },
        drilldown: {
          kind: 'agent',
          why: 'Opens a short checked page for each name the post leans on.',
          after: ['citations'],
          card: drilldown,
        },
        seo: {
          kind: 'agent',
          why: 'Makes the page readable to search and answer engines, honestly.',
          after: ['convert'],
          card: seo,
        },
        safety: {
          kind: 'guard',
          why: 'Holds anything that would land as hate or contempt.',
          after: ['convert', 'image', 'diagram', 'drilldown', 'seo'],
          card: safety,
        },
        security: {
          kind: 'guard',
          why: 'Holds anything carrying someone else’s data or a secret.',
          after: ['convert', 'image', 'diagram', 'drilldown', 'seo'],
          card: security,
        },
        publish: {
          kind: 'agent',
          why: 'Assembles one pull request a reviewer can read in a minute.',
          after: ['safety', 'security'],
          card: publish,
        },
        merge: {
          kind: 'gate',
          why: 'Nothing goes live until Victor has read it and merged it.',
          after: ['publish'],
          asks: 'approve',
          question: 'Merge this pull request?',
        },
        main: {
          kind: 'sink',
          why: 'A merge to main deploys the post to blog.victorsaly.com.',
          after: ['merge'],
          target: githubPullRequest({ repo: 'victorsaly/agentic-blog' }),
        },
      },
    },
  ],

  runtime: {
    kind: 'cloudflare',
    worker: 'agentic-blog',
    domain: 'blog.victorsaly.com',
    access: ['info@victorsaly.com'],
    buckets: ['agentic-blog-audio'],
  },
});
