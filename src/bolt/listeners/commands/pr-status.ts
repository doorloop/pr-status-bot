import type { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { getPRStatus } from '../../../services/github.js';
import { formatPRStatusBlocks, formatErrorBlocks, formatHelpBlocks } from '../../../services/slack.js';
import { getTeamMembers, getAllMembers, getAvailableTeams } from '../../../services/teams.js';

const prStatusCallback = async ({
  ack,
  respond,
  command,
  logger,
}: AllMiddlewareArgs & SlackCommandMiddlewareArgs) => {
  await ack();

  const text = command.text.trim().toLowerCase();

  // Help command
  if (text === 'help') {
    await respond({
      blocks: formatHelpBlocks(getAvailableTeams()),
      response_type: 'ephemeral',
    });
    return;
  }

  // Acknowledge with loading message
  await respond({
    text: 'Fetching PR status... ⏳',
    response_type: 'ephemeral',
  });

  try {
    let authors: string[];
    let teamName: string | undefined;

    if (text === '' || text === 'all') {
      authors = getAllMembers();
    } else {
      try {
        authors = getTeamMembers(text);
        teamName = text;
      } catch {
        await respond({
          blocks: formatErrorBlocks(`Unknown team "${text}". Available: ${getAvailableTeams().join(', ')}`),
          response_type: 'ephemeral',
          replace_original: true,
        });
        return;
      }
    }

    if (authors.length === 0) {
      await respond({
        blocks: formatErrorBlocks('No team members configured.'),
        response_type: 'ephemeral',
        replace_original: true,
      });
      return;
    }

    const categorizedPRs = await getPRStatus(authors);

    await respond({
      blocks: formatPRStatusBlocks(categorizedPRs, teamName),
      response_type: 'in_channel',
      replace_original: true,
    });
  } catch (error) {
    logger.error('Error fetching PR status:', error);
    await respond({
      blocks: formatErrorBlocks(error instanceof Error ? error.message : 'Unexpected error'),
      response_type: 'ephemeral',
      replace_original: true,
    });
  }
};

export default prStatusCallback;
