import { Octokit } from '@octokit/rest';

interface Teams {
  [teamName: string]: string[];
}

// Cache for GitHub teams (fetched once per cold start)
let teamsCache: Teams | null = null;

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  return new Octokit({ auth: token });
}

async function fetchTeams(): Promise<Teams> {
  const org = process.env.GITHUB_OWNER;
  if (!org) throw new Error('GITHUB_OWNER not set');

  const client = getOctokit();
  const teams: Teams = {};

  const { data: orgTeams } = await client.teams.list({
    org,
    per_page: 100,
  });

  await Promise.all(
    orgTeams.map(async (team) => {
      try {
        const { data: members } = await client.teams.listMembersInOrg({
          org,
          team_slug: team.slug,
          per_page: 100,
        });
        teams[team.slug] = members.map(m => m.login);
      } catch {
        // Skip teams we can't access
      }
    })
  );

  return teams;
}

export async function getTeams(): Promise<Teams> {
  if (teamsCache === null) {
    teamsCache = await fetchTeams();
  }
  return teamsCache;
}

export async function getTeamMembers(teamName: string): Promise<string[]> {
  const teams = await getTeams();
  const team = Object.entries(teams).find(
    ([name]) => name.toLowerCase() === teamName.toLowerCase()
  );
  if (!team) {
    throw new Error(`Team "${teamName}" not found. Available: ${Object.keys(teams).join(', ')}`);
  }
  return team[1];
}

export async function getAllMembers(): Promise<string[]> {
  const teams = await getTeams();
  const all = new Set<string>();
  for (const members of Object.values(teams)) {
    members.forEach(m => all.add(m));
  }
  return Array.from(all);
}

export async function getAvailableTeams(): Promise<string[]> {
  const teams = await getTeams();
  return Object.keys(teams);
}
