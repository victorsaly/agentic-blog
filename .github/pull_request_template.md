<!-- Why: one concern per pull request, and a reviewer should know in a minute what to look at. -->

## What this is

<!-- One or two lines. For content: the thought slug and which files are new or changed. -->

## Why

<!-- The reason, in plain words. For a conversion, the why is already in the file's front matter; point at it. -->

## Before and after

<!-- When this changes what a reader or the studio shows: the same part of the page before and after, on a
     desk and a phone. Run the branch (npm run dev), then
     npm run pr:shots -- --pr <number> --page /path --part name=.selector --publish
     and paste the table it prints. Nothing visible changed? Say so in one line. -->

## Look at first

<!-- The two or three places most likely to sound wrong, with the line quoted. -->

## Checks

- [ ] Every new file has a `why:`
- [ ] Nothing under `origin/` was edited
- [ ] `npm run lint && npm run typecheck && npm run test` pass locally
