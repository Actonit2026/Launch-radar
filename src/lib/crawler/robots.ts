type RobotsRule = {
  agent: string;
  directive: "allow" | "disallow";
  path: string;
};

type RobotsPolicy = {
  fetchedAt: number;
  rules: RobotsRule[];
};

const robotsCache = new Map<string, RobotsPolicy | null>();
const robotsCacheTtlMs = 6 * 60 * 60 * 1000;
const robotsTimeoutMs = 5000;

function botUserAgent() {
  return process.env.LAUNCHRADAR_USER_AGENT ?? "LaunchRadarBot/1.0";
}

export function crawlerUserAgent() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://launch-radar-smoky.vercel.app";

  return `${botUserAgent()} (+${siteUrl.replace(/\/$/, "")}/bot)`;
}

function robotsUrlFor(url: string) {
  const parsed = new URL(url);

  return `${parsed.origin}/robots.txt`;
}

function parseRobots(text: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let agents: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();

    if (!line) {
      continue;
    }

    const [rawKey, ...rawValueParts] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();

    if (!key) {
      continue;
    }

    if (key === "user-agent") {
      agents = [value.toLowerCase()];
      continue;
    }

    if ((key === "allow" || key === "disallow") && agents.length) {
      if (key === "disallow" && !value) {
        continue;
      }

      for (const agent of agents) {
        rules.push({
          agent,
          directive: key,
          path: value || "/",
        });
      }
    }
  }

  return rules;
}

async function fetchRobotsPolicy(url: string) {
  const robotsUrl = robotsUrlFor(url);
  const cached = robotsCache.get(robotsUrl);

  if (cached && Date.now() - cached.fetchedAt < robotsCacheTtlMs) {
    return cached;
  }

  if (robotsCache.has(robotsUrl) && cached === null) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), robotsTimeoutMs);

  try {
    const response = await fetch(robotsUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/plain,*/*",
        "user-agent": crawlerUserAgent(),
      },
    });

    if (!response.ok) {
      robotsCache.set(robotsUrl, null);
      return null;
    }

    const policy = {
      fetchedAt: Date.now(),
      rules: parseRobots(await response.text()),
    };

    robotsCache.set(robotsUrl, policy);
    return policy;
  } catch {
    robotsCache.set(robotsUrl, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function matchingRules(policy: RobotsPolicy, pathname: string) {
  const agentName = botUserAgent().toLowerCase();
  const applicableRules = policy.rules.filter(
    (rule) => rule.agent === "*" || agentName.includes(rule.agent),
  );

  return applicableRules
    .filter((rule) => pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);
}

export async function isAllowedByRobots(url: string) {
  if (process.env.LAUNCHRADAR_IGNORE_ROBOTS === "1") {
    return true;
  }

  const policy = await fetchRobotsPolicy(url);

  if (!policy) {
    return true;
  }

  const pathname = new URL(url).pathname || "/";
  const rule = matchingRules(policy, pathname)[0];

  return rule ? rule.directive === "allow" : true;
}
