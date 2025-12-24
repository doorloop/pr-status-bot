import type { Teams } from '../types';

export function getTeams(): Teams {
  const teamNames = process.env.TEAM_NAMES;

  if (!teamNames) {
    throw new Error('TEAM_NAMES environment variable is not set');
  }

  const teams: Teams = {};
  const names = teamNames.split(',').map(n => n.trim()).filter(Boolean);

  for (const name of names) {
    const envKey = `TEAM_${name.toUpperCase()}`;
    const members = process.env[envKey];

    if (!members) {
      console.warn(`Warning: ${envKey} environment variable is not set`);
      teams[name] = [];
      continue;
    }

    teams[name] = members.split(',').map(m => m.trim()).filter(Boolean);
  }

  return teams;
}

export function getTeamMembers(teamName: string): string[] {
  const teams = getTeams();
  const normalizedName = teamName.toLowerCase();

  const team = Object.entries(teams).find(
    ([name]) => name.toLowerCase() === normalizedName
  );

  if (!team) {
    throw new Error(`Team "${teamName}" not found. Available teams: ${Object.keys(teams).join(', ')}`);
  }

  return team[1];
}

export function getAllMembers(): string[] {
  const teams = getTeams();
  const allMembers = new Set<string>();

  for (const members of Object.values(teams)) {
    for (const member of members) {
      allMembers.add(member);
    }
  }

  return Array.from(allMembers);
}

export function getAvailableTeams(): string[] {
  return Object.keys(getTeams());
}
