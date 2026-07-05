import { Link } from 'react-router-dom'

// #359 — turn bare URLs in coach-authored text (plan notes, reviews) into clickable links. Internal
// Platyplus links navigate in-app (SPA <Link>); external links open in a new tab.
const URL_RE = /(https?:\/\/[^\s)]+)/g
const INTERNAL_RE = /^https?:\/\/platyplus[^/]*\.duckdns\.org(\/[^\s)]*)/i

export function linkify(text: string): React.ReactNode[] {
  return String(text || '').split(URL_RE).map((part, i) => {
    if (!/^https?:\/\//.test(part)) return part
    const internal = part.match(INTERNAL_RE)
    if (internal) return <Link key={i} to={internal[1]} className="linkified">{part}</Link>
    return <a key={i} href={part} target="_blank" rel="noreferrer" className="linkified">{part}</a>
  })
}
