// Why: a topic is written the same way on every page a reader sees it. Tags are made into words by
// themeLabel; the few that read wrong that way get their name from settings.yml, which Victor edits.
import { settings } from './settings';
import { themeLabel } from './themes';

/** How a topic is written for readers: its name from settings.yml, or its tag made into words. */
export const topicName = (topic: string): string => themeLabel(topic, settings.topic_names);
