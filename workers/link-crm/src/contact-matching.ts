/** Segments where multiple names appear together (connected by "and" or commas). */
export function extractCoListedNameClusters(text: string): string[] {
  const clusters: string[] = []
  const verbPattern =
    /\b(?:met|meet|meeting|with|lunched|lunch(?:ed)?|dinner|coffee|chat(?:ted|ting)?|talk(?:ed|ing)?|saw|see|called|call(?:ed|ing)?|joined|join(?:ed|ing)?|watched|hang(?:out|ing)?|drinks?)\s+(?:with\s+)?([^.;!?\n]+)/gi

  let match: RegExpExecArray | null
  while ((match = verbPattern.exec(text)) !== null) {
    let segment = match[1].trim()
    segment = segment.replace(/\s+\b(?:at|on|in|today|yesterday|last|this)\b.*/i, '').trim()
    if (/\band\b|,/.test(segment)) {
      clusters.push(segment)
    }
  }
  return clusters
}

function nameAppearsInCluster(cluster: string, name: string): boolean {
  const clusterLower = cluster.toLowerCase()
  const nameLower = name.toLowerCase()
  if (clusterLower.includes(nameLower)) return true
  const parts = nameLower.split(/\s+/).filter(Boolean)
  return parts.length > 0 && parts.some((part) => part.length > 2 && clusterLower.includes(part))
}

/** True when every name appears in the same co-listed phrase (e.g. "Bill and Mary"). */
export function areContactsCoListed(text: string, names: string[]): boolean {
  if (names.length <= 1) return true
  const clusters = extractCoListedNameClusters(text)
  if (clusters.length === 0) return false
  return clusters.some((cluster) =>
    names.every((name) => nameAppearsInCluster(cluster, name)),
  )
}

/** Keep all contacts when co-listed; otherwise return the single best match. */
export function filterToCoListedContacts<T extends { name: string }>(
  text: string,
  contacts: T[],
): T[] {
  if (contacts.length <= 1) return contacts
  if (areContactsCoListed(text, contacts.map((c) => c.name))) {
    return contacts
  }

  const textLower = text.toLowerCase()
  let best = contacts[0]
  let bestIndex = Infinity

  for (const contact of contacts) {
    const parts = contact.name.toLowerCase().split(/\s+/).filter(Boolean)
    for (const part of parts) {
      const idx = textLower.indexOf(part)
      if (idx >= 0 && idx < bestIndex) {
        bestIndex = idx
        best = contact
      }
    }
  }

  return [best]
}
