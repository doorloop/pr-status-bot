import { Octokit } from '@octokit/rest';

interface Teams {
  [teamName: string]: string[];
}

// Cache for GitHub teams (fetched once per cold start)
let githubTeamsCache: Teams | null = null;

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  return new Octokit({ auth: token });
}

// =============================================================================
// ENV-BASED TEAMS (fallback/override)
// =============================================================================

function getEnvTeams(): Teams {
  const teamNames = process.env.TEAM_NAMES;
  if (!teamNames) return {};

  const teams: Teams = {};
  const names = teamNames.split(',').map(n => n.trim()).filter(Boolean);

  for (const name of names) {
    const envKey = `TEAM_${name.toUpperCase()}`;
    const members = process.env[envKey];
    if (members) {
      teams[name] = members.split(',').map(m => m.trim()).filter(Boolean);
    }
  }
  return teams;
}

// =============================================================================
// GITHUB ORG TEAMS
// =============================================================================

async function fetchGitHubTeams(): Promise<Teams> {
  const org = process.env.GITHUB_OWNER;
  if (!org) return {};

  const client = getOctokit();
  const teams: Teams = {};

  try {
    // List all teams in the org
    const { data: orgTeams } = await client.teams.list({
      org,
      per_page: 100,
    });

    // Fetch members for each team
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
  } catch {
    // Org teams not accessible (might be a user repo, not org)
  }

  return teams;
}

async function getGitHubTeams(): Promise<Teams> {
  if (githubTeamsCache === null) {
    githubTeamsCache = await fetchGitHubTeams();
  }
  return githubTeamsCache;
}

// =============================================================================
// MERGED TEAMS (GitHub + ENV overrides)
// =============================================================================

export async function getTeams(): Promise<Teams> {
  const [githubTeams, envTeams] = await Promise.all([
    getGitHubTeams(),
    Promise.resolve(getEnvTeams()),
  ]);

  // ENV teams override/extend GitHub teams
  return { ...githubTeams, ...envTeams };
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
