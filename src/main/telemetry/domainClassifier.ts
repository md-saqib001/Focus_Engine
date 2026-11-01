export interface ClassificationResult {
  domain: string
  category: 'productive' | 'distraction' | 'neutral' | 'unknown'
}

// Productive keywords and their canonical domain mapping
const PRODUCTIVE_MAP: { [key: string]: string } = {
  codeforces: 'codeforces.com',
  leetcode: 'leetcode.com',
  geeksforgeeks: 'geeksforgeeks.org',
  stackoverflow: 'stackoverflow.com',
  github: 'github.com',
  'google docs': 'docs.google.com',
  codechef: 'codechef.com',
  atcoder: 'atcoder.jp',
  notion: 'notion.so'
}

// Productive window title file extensions
const PRODUCTIVE_EXTENSIONS = ['.cpp', '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.rs', '.go', '.java', '.kt']

// Distraction keywords and their canonical domain mapping
const DISTRACTION_MAP: { [key: string]: string } = {
  youtube: 'youtube.com',
  instagram: 'instagram.com',
  facebook: 'facebook.com',
  discord: 'discord.com',
  netflix: 'netflix.com',
  reddit: 'reddit.com',
  twitter: 'twitter.com',
  'x.com': 'x.com'
}

// Common browser process names
const BROWSER_PROCESSES = ['chrome', 'brave', 'msedge', 'firefox', 'opera', 'iexplore', 'safari']

/**
 * Classifies an active window title and app name into a domain and productivity category.
 */
export function classifyWindow(appName: string, windowTitle: string): ClassificationResult {
  const appLower = appName.toLowerCase()
  const titleLower = windowTitle.toLowerCase()

  // 1. Try to extract domain from window title if it's a web browser
  const isBrowser = BROWSER_PROCESSES.some((b) => appLower.includes(b))
  let extractedDomain = ''

  if (isBrowser) {
    // Regex to match a basic domain format in the window title (e.g. leetcode.com, youtube.com)
    const domainRegex = /([a-z0-9|-]+\.[a-z0-9|-]+(?:\.[a-z]{2,})?)/gi
    const matches = titleLower.match(domainRegex)
    if (matches && matches.length > 0) {
      extractedDomain = matches[matches.length - 1]
    }
  }

  // 2. Check for Distractions
  for (const [keyword, domain] of Object.entries(DISTRACTION_MAP)) {
    if (titleLower.includes(keyword) || appLower.includes(keyword) || (extractedDomain && extractedDomain.includes(keyword))) {
      return {
        domain: domain,
        category: 'distraction'
      }
    }
  }

  // 3. Check for Productive targets
  for (const [keyword, domain] of Object.entries(PRODUCTIVE_MAP)) {
    if (titleLower.includes(keyword) || appLower.includes(keyword) || (extractedDomain && extractedDomain.includes(keyword))) {
      return {
        domain: domain,
        category: 'productive'
      }
    }
  }

  // 4. Check for VS Code and programming file extensions
  if (
    appLower.includes('vscode') ||
    appLower.includes('code') ||
    appLower.includes('visual studio') ||
    PRODUCTIVE_EXTENSIONS.some((ext) => titleLower.endsWith(ext) || titleLower.includes(`${ext} `) || titleLower.includes(`${ext}-`))
  ) {
    return {
      domain: 'vscode',
      category: 'productive'
    }
  }

  // 5. Check for Focus Engine app itself (including development Electron processes)
  if (appLower.includes('focus engine') || appLower.includes('electron') || titleLower.includes('focus engine')) {
    return {
      domain: 'focus-engine',
      category: 'productive'
    }
  }

  // 6. Check neutral processes (e.g. system controls, explorer, finder)
  const neutralKeywords = ['explorer', 'finder', 'taskmgr', 'systemsettings', 'system preferences', 'desktop']
  if (neutralKeywords.some((nk) => appLower.includes(nk))) {
    return {
      domain: appLower,
      category: 'neutral'
    }
  }

  // 6. Fallback to unknown / appName
  return {
    domain: extractedDomain || appLower,
    category: 'unknown'
  }
}
