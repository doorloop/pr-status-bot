import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SlackSlashCommandPayload } from '../types';
import { getPRStatus } from '../services/github';
import { formatPRStatusMessage, formatErrorMessage, formatHelpMessage } from '../services/slack';
import { getTeamMembers, getAllMembers, getAvailableTeams } from '../services/teams';

export async function handleSlashCommand(
  request: FastifyRequest<{ Body: SlackSlashCommandPayload }>,
  reply: FastifyReply
): Promise<void> {
  const { text } = request.body;
  const command = text.trim().toLowerCase();

  try {
    // Handle help command
    if (command === 'help') {
      const teams = getAvailableTeams();
      const response = formatHelpMessage(teams);
      reply.send(response);
      return;
    }

    let authors: string[];
    let teamName: string | undefined;

    if (command === '' || command === 'all') {
      // Get all members from all teams
      authors = getAllMembers();
    } else {
      // Get members from specific team
      try {
        authors = getTeamMembers(command);
        teamName = command;
      } catch {
        const teams = getAvailableTeams();
        const response = formatErrorMessage(
          `Unknown team "${command}". Available teams: ${teams.join(', ')}`
        );
        reply.send(response);
        return;
      }
    }

    if (authors.length === 0) {
      const response = formatErrorMessage('No team members configured.');
      reply.send(response);
      return;
    }

    const categorizedPRs = await getPRStatus(authors);
    const response = formatPRStatusMessage(categorizedPRs, teamName);

    reply.send(response);
  } catch (error) {
    console.error('Error handling slash command:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const response = formatErrorMessage(message);
    reply.send(response);
  }
}
