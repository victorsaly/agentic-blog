// Why: a topic is written the same way on every page a reader sees it. Tags are made into words by
// themeLabel; the few that read wrong that way get their name from settings.yml, which Victor edits.
import { settings } from './settings';
import { themeAbout, themeLabel } from './themes';

/** How a topic is written for readers: its name from settings.yml, or its tag made into words. */
export const topicName = (topic: string): string => themeLabel(topic, settings.topic_names);

/** What a topic is about, in one plain line from settings.yml, or undefined when Victor has not written one. */
export const topicAbout = (topic: string): string | undefined => themeAbout(topic, settings.topics);
