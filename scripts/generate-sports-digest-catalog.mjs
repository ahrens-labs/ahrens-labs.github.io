#!/usr/bin/env node
/** Refresh team list from ESPN → workers + sports_digest catalogs. */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const TWITTER = {
  'mlb-8': ['AdamMcCalvy', 'Todd_Rosiak', 'CyrtHogg'],
  'nfl-9': ['AaronNagler', 'WesHod', 'RobDemovsky', 'ZachKruse2', 'ByRyanWood'],
  'nba-15': ['NathanMarzion', 'eric_nehm'],
};

const LEAGUE_UNION =
  '"mlb" | "nfl" | "nba" | "nhl" | "epl" | "wc26" | "cfb-b10" | "cfb-sec" | "cbb-b10" | "cbb-sec"';

/** Limited-time FIFA World Cup 2026 — remove from generator after the tournament ends. */
const WORLD_CUP_AVAILABLE_UNTIL = '2026-07-20T23:59:59Z';

/** ESPN core API conference groups (FBS / D-I). */
const CONFERENCES = [
  {
    sportPath: 'football',
    leaguePath: 'college-football',
    groupId: 5,
    leagueKey: 'cfb-b10',
    sportLabel: 'Big Ten Football',
    season: 2025,
  },
  {
    sportPath: 'football',
    leaguePath: 'college-football',
    groupId: 8,
    leagueKey: 'cfb-sec',
    sportLabel: 'SEC Football',
    season: 2025,
  },
  {
    sportPath: 'basketball',
    leaguePath: 'mens-college-basketball',
    groupId: 7,
    leagueKey: 'cbb-b10',
    sportLabel: 'Big Ten Basketball',
    season: 2026,
  },
  {
    sportPath: 'basketball',
    leaguePath: 'mens-college-basketball',
    groupId: 23,
    leagueKey: 'cbb-sec',
    sportLabel: 'SEC Basketball',
    season: 2026,
  },
];

function pickLogo(logos) {
  if (!Array.isArray(logos)) return '';
  const light =
    logos.find((l) => Array.isArray(l.rel) && l.rel.includes('default') && l.rel.includes('full')) ||
    logos.find((l) => typeof l.href === 'string' && l.href.includes('/500/') && !l.href.includes('-dark')) ||
    logos.find((l) => typeof l.href === 'string' && l.href.includes('teamlogos')) ||
    logos[0];
  return light?.href || '';
}

async function fetchLeague(leaguePath, leagueKey, sportLabel) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/teams?limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${leagueKey}: ${res.status}`);
  const d = await res.json();
  const teams = d.sports[0].leagues[0].teams;
  return teams
    .map(({ team: tm }) => {
      const eid = String(tm.id);
      const id = `${leagueKey}-${eid}`;
      return {
        id,
        league: leagueKey,
        espnTeamId: eid,
        label: tm.displayName,
        abbr: tm.abbreviation || '',
        sport: sportLabel,
        googleQuery: `"${tm.displayName}" ${sportLabel}`,
        twitterHandles: TWITTER[id] || [],
        logoUrl: pickLogo(tm.logos),
        color: typeof tm.color === 'string' ? tm.color : '',
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchConference(conf) {
  const listUrl =
    `https://sports.core.api.espn.com/v2/sports/${conf.sportPath}/leagues/${conf.leaguePath}` +
    `/seasons/${conf.season}/types/2/groups/${conf.groupId}/teams?limit=30`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) throw new Error(`ESPN ${conf.leagueKey} group ${conf.groupId}: ${listRes.status}`);
  const listData = await listRes.json();
  const refs = (listData.items || []).map((item) => item.$ref).filter(Boolean);
  const teams = [];
  for (const ref of refs) {
    const teamRes = await fetch(ref);
    if (!teamRes.ok) continue;
    const tm = await teamRes.json();
    const eid = String(tm.id);
    const id = `${conf.leagueKey}-${eid}`;
    teams.push({
      id,
      league: conf.leagueKey,
      espnTeamId: eid,
      label: tm.displayName || tm.name || '',
      abbr: tm.abbreviation || '',
      sport: conf.sportLabel,
      googleQuery: `"${tm.displayName || tm.name}" ${conf.sportLabel}`,
      twitterHandles: TWITTER[id] || [],
      logoUrl: pickLogo(tm.logos),
      color: typeof tm.color === 'string' ? tm.color : '',
    });
  }
  return teams.sort((a, b) => a.label.localeCompare(b.label));
}

const coreCatalog = [
  ...(await fetchLeague('baseball/mlb', 'mlb', 'MLB')),
  ...(await fetchLeague('football/nfl', 'nfl', 'NFL')),
  ...(await fetchLeague('basketball/nba', 'nba', 'NBA')),
  ...(await fetchLeague('hockey/nhl', 'nhl', 'NHL')),
  ...(await fetchLeague('soccer/eng.1', 'epl', 'Premier League')),
  ...(await fetchConference(CONFERENCES[0])),
  ...(await fetchConference(CONFERENCES[1])),
  ...(await fetchConference(CONFERENCES[2])),
  ...(await fetchConference(CONFERENCES[3])),
];

const worldCupCatalog =
  Date.now() <= Date.parse(WORLD_CUP_AVAILABLE_UNTIL)
    ? await fetchLeague('soccer/fifa.world', 'wc26', 'World Cup 2026')
    : [];

const catalog = [...coreCatalog, ...worldCupCatalog];

writeFileSync(join(root, 'scripts/sports-digest-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(
  join(root, 'workers/src/sports-digest-team-catalog.js'),
  `/** Auto-generated — run scripts/generate-sports-digest-catalog.mjs to refresh */\nexport const SPORTS_DIGEST_TEAM_CATALOG = ${JSON.stringify(coreCatalog, null, 2)};\n`
);
writeFileSync(
  join(root, 'workers/src/sports-digest-world-cup-catalog.js'),
  `/** Auto-generated — limited-time World Cup 2026 teams */\nexport const SPORTS_DIGEST_WORLD_CUP_AVAILABLE_UNTIL = ${JSON.stringify(WORLD_CUP_AVAILABLE_UNTIL)};\nexport const SPORTS_DIGEST_WORLD_CUP_CATALOG = ${JSON.stringify(worldCupCatalog, null, 2)};\n`
);

const sportsDigestTs = '/home/matt/innovation/sports_digest/src/teamCatalog.ts';
try {
  writeFileSync(
    sportsDigestTs,
    `/** Auto-generated — sync from ahrens-labs scripts/sports-digest-catalog.json */\nexport type CatalogTeam = {\n  id: string;\n  league: ${LEAGUE_UNION};\n  espnTeamId: string;\n  label: string;\n  abbr: string;\n  sport: string;\n  googleQuery: string;\n  twitterHandles: string[];\n  logoUrl: string;\n  color: string;\n};\n\nexport const TEAM_CATALOG: CatalogTeam[] = ${JSON.stringify(catalog, null, 2)};\n`
  );
} catch (e) {
  console.warn('Could not write sports_digest teamCatalog.ts:', e.message);
}

console.log(`Wrote ${catalog.length} teams`);
