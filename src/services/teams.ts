interface Teams {
  [teamName: string]: string[];
}

export function getTeams(): Teams {
  const teamNames = process.env.TEAM_NAMES;
  if (!teamNames) throw new Error('TEAM_NAMES environment variable is not set');

  const teams: Teams = {};
  const names = teamNames.split(',').map(n => n.trim()).filter(Boolean);

  for (const name of names) {
    const envKey = `TEAM_${name.toUpperCase()}`;
    const members = process.env[envKey];
    teams[name] = members ? members.split(',').map(m => m.trim()).filter(Boolean) : [];
  }
  return teams;
}

export function getTeamMembers(teamName: string): string[] {
  const teams = getTeams();
  const team = Object.entries(teams).find(([name]) => name.toLowerCase() === teamName.toLowerCase());
  if (!team) throw new Error(`Team "${teamName}" not found. Available: ${Object.keys(teams).join(', ')}`);
  return team[1];
}

export function getAllMembers(): string[] {
  const teams = getTeams();
  const all = new Set<string>();
  for (const members of Object.values(teams)) members.forEach(m => all.add(m));
  return Array.from(all);
}

export function getAvailableTeams(): string[] {
  return Object.keys(getTeams());
}
