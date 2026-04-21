import { useEffect, useState } from 'react'
import { Box, Typography, Chip, CircularProgress, Divider, Tooltip } from '@mui/material'
import HubIcon        from '@mui/icons-material/Hub'
import BoltIcon       from '@mui/icons-material/Bolt'
import TimelineIcon   from '@mui/icons-material/Timeline'

interface GodNode {
  node_id:   string
  node_type: string
  name:      string
  degree:    number
  graph_url: string
}

interface Predicate {
  predicate: string
  count:     number
}

interface Hub {
  node_id:   string
  name:      string
  degree:    number
  graph_url: string
}

interface Contribution {
  alias:      string
  doc_type:   string
  status:     string
  created_at: string
}

interface Summary {
  god_nodes:            GodNode[]
  top_predicates:       Predicate[]
  node_type_breakdown:  Record<string, number>
  network: {
    total_nodes: number
    total_edges: number
    density:     number
  }
  hubs_by_type:         Record<string, Hub>
  recent_contributions: Contribution[]
}

const NODE_COLORS: Record<string, string> = {
  PROPERTY:     '#E8A838',
  ORGANIZATION: '#1D9E75',
  PERSON:       '#7F77DD',
  DEAL:         '#D85A30',
  DOCUMENT:     '#5DCAA5',
  MEETING:      '#2B8FD4',
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: '#1D9E75',
  PENDING: '#BA7517',
  FAILED:  '#D85A30',
}

interface Props {
  onFocusNode: (nodeId: string) => void
}

export default function GraphSummaryPanel({ onFocusNode }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/graph/summary')
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setSummary(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      <CircularProgress size={20} />
    </Box>
  )

  if (error || !summary) return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.disabled">
        {error || 'No summary available'}
      </Typography>
    </Box>
  )

  const { god_nodes = [], top_predicates = [], network, hubs_by_type = {}, recent_contributions = [] } = summary

  if (!network) return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.disabled">Loading network stats...</Typography>
    </Box>
  )

  const baseUrl = window.location.origin

  // Deduplicate by node_id (same node can appear with different node_types
  // due to dirty subject_type/object_type values in RELATIONSHIPS)
  const seenIds = new Set<string>()
  const GENERIC_NAMES = new Set(['lender', 'borrower', 'guarantor', 'trustee', 'agent'])
  const deduped_god_nodes = god_nodes
    .filter(n => {
      if (seenIds.has(n.node_id)) return false
      if (GENERIC_NAMES.has(n.name.toLowerCase())) return false
      seenIds.add(n.node_id)
      return true
    })
    .slice(0, 10)

  return (
    <Box sx={{ overflow: 'auto', height: '100%', pb: 3 }}>

      {/* Network stats strip */}
      <Box sx={{
        display: 'flex', gap: 2, px: 2, py: 1.5,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.02)',
      }}>
        {[
          { label: 'Nodes', value: network.total_nodes.toLocaleString() },
          { label: 'Edges', value: network.total_edges.toLocaleString() },
          { label: 'Density', value: (network.density * 100).toFixed(4) + '%' },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem' }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* God nodes */}
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <HubIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            God Nodes
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', ml: 0.5 }}>
            — most connected
          </Typography>
        </Box>

        {deduped_god_nodes.map((node, i) => (
          <Box
            key={node.node_id}
            onClick={() => onFocusNode(node.node_id)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              py: 0.5, px: 0.5, borderRadius: 1, cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              transition: 'background 0.15s',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', width: 14, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}
            </Typography>
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              bgcolor: NODE_COLORS[node.node_type] || '#888',
            }} />
            <Typography variant="caption" sx={{
              flex: 1, fontSize: '0.72rem', color: 'text.primary',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {node.name}
            </Typography>
            <Tooltip title={`${node.degree} relationships`}>
              <Chip
                label={node.degree}
                size="small"
                sx={{
                  height: 16, fontSize: '0.6rem', flexShrink: 0,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'text.secondary',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Tooltip>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* Top predicates */}
      <Box sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <BoltIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Top Relationships
          </Typography>
        </Box>

        {top_predicates.slice(0, 6).map(({ predicate, count }) => {
          const maxCount = top_predicates[0]?.count || 1
          const pct = (count / maxCount) * 100
          return (
            <Box key={predicate} sx={{ mb: 0.75 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                  {predicate}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                  {count.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ height: 3, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', width: `${pct}%`,
                  bgcolor: '#1D9E75', borderRadius: 1,
                  transition: 'width 0.4s ease',
                }} />
              </Box>
            </Box>
          )
        })}
      </Box>

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* Hubs by type */}
      <Box sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <TimelineIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Most Connected Per Type
          </Typography>
        </Box>

        {Object.entries(hubs_by_type).map(([ntype, hub]) => (
          <Box
            key={ntype}
            onClick={() => onFocusNode(hub.node_id)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              py: 0.4, px: 0.5, borderRadius: 1, cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              bgcolor: NODE_COLORS[ntype] || '#888',
            }} />
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', width: 80, flexShrink: 0 }}>
              {ntype}
            </Typography>
            <Typography variant="caption" sx={{
              flex: 1, fontSize: '0.7rem', color: 'text.primary',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {hub.name}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled', flexShrink: 0 }}>
              {hub.degree}
            </Typography>
          </Box>
        ))}
      </Box>

      {recent_contributions.length > 0 && (
        <>
          <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* Recent contributions */}
          <Box sx={{ px: 2 }}>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mb: 1 }}>
              Recent Contributions
            </Typography>
            {recent_contributions.map((c, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  bgcolor: STATUS_COLORS[c.status] || '#888',
                }} />
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', flex: 1 }}>
                  {c.alias} — {c.doc_type}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', flexShrink: 0 }}>
                  {c.created_at.slice(5, 16)}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}

    </Box>
  )
}
