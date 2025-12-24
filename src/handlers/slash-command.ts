import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SlackSlashCommandPayload } from '../types';
import { getPRStatus } from '../services/github';
import { formatPRStatusMessage, formatErrorMessage, formatHelpMessage } from '../services/slack';
import { getTeamMembers, getAllMembers, getAvailableTeams } from '../services/teams';

async function sendDelayedResponse(responseUrl: string, body: object): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Error sending delayed response:', error);
  }
}

export async function handleSlashCommand(
  request: FastifyRequest<{ Body: SlackSlashCommandPayload }>,
  reply: FastifyReply
): Promise<void> {
  const { text, response_url } = request.body;
  const command = text.trim().toLowerCase();

  // Handle help command - fast, respond immediately
  if (command === 'help') {
    const teams = getAvailableTeams();
    const response = formatHelpMessage(teams);
    reply.send(response);
    return;
  }

  // For PR fetching, respond immediately then send results async
  reply.send({
    response_type: 'ephemeral',
    text: 'Fetching PR status... :hourglass_flowing_sand:',
  });

  // Process async after responding
  setImmediate(async () => {
    try {
      let authors: string[];
      let teamName: string | undefined;

      if (command === '' || command === 'all') {
        authors = getAllMembers();
      } else {
        try {
          authors = getTeamMembers(command);
          teamName = command;
        } catch {
          const teams = getAvailableTeams();
          await sendDelayedResponse(response_url, formatErrorMessage(
            `Unknown team "${command}". Available teams: ${teams.join(', ')}`
          ));
          return;
        }
      }

      if (authors.length === 0) {
        await sendDelayedResponse(response_url, formatErrorMessage('No team members configured.'));
        return;
      }

      const categorizedPRs = await getPRStatus(authors);
      const response = formatPRStatusMessage(categorizedPRs, teamName);

      await sendDelayedResponse(response_url, response);
    } catch (error) {
      console.error('Error handling slash command:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      await sendDelayedResponse(response_url, formatErrorMessage(message));
    }
  });
}
