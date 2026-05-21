#!/usr/bin/env node
/** Refresh MLB/NFL/NBA team list from ESPN → workers + sports_digest catalogs. */
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
      const logos = Array.isArray(tm.logos) ? tm.logos : [];
      const defaultLogo =
        logos.find((l) => Array.isArray(l.rel) && l.rel.includes('default') && l.rel.includes('full')) ||
        logos.find((l) => Array.isArray(l.rel) && l.rel.includes('default')) ||
        logos[0];
      return {
        id,
        league: leagueKey,
        espnTeamId: eid,
        label: tm.displayName,
        abbr: tm.abbreviation || '',
        sport: sportLabel,
        googleQuery: `"${tm.displayName}" ${sportLabel}`,
        twitterHandles: TWITTER[id] || [],
        logoUrl: defaultLogo?.href || '',
        color: typeof tm.color === 'string' ? tm.color : '',
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

const catalog = [
  ...(await fetchLeague('baseball/mlb', 'mlb', 'MLB')),
  ...(await fetchLeague('football/nfl', 'nfl', 'NFL')),
  ...(await fetchLeague('basketball/nba', 'nba', 'NBA')),
];

writeFileSync(join(root, 'scripts/sports-digest-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(
  join(root, 'workers/src/sports-digest-team-catalog.js'),
  `/** Auto-generated — run scripts/generate-sports-digest-catalog.mjs to refresh */\nexport const SPORTS_DIGEST_TEAM_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`
);

const sportsDigestTs = '/home/matt/innovation/sports_digest/src/teamCatalog.ts';
try {
  writeFileSync(
    sportsDigestTs,
    `/** Auto-generated — sync from ahrens-labs scripts/sports-digest-catalog.json */\nexport type CatalogTeam = {\n  id: string;\n  league: "mlb" | "nfl" | "nba";\n  espnTeamId: string;\n  label: string;\n  abbr: string;\n  sport: string;\n  googleQuery: string;\n  twitterHandles: string[];\n  logoUrl: string;\n  color: string;\n};\n\nexport const TEAM_CATALOG: CatalogTeam[] = ${JSON.stringify(catalog, null, 2)};\n`
  );
} catch (e) {
  console.warn('Could not write sports_digest teamCatalog.ts:', e.message);
}

console.log(`Wrote ${catalog.length} teams`);
