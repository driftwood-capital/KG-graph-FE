import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Typography, Divider, Chip, Stack,
  TextField, Slider, Button, CircularProgress,
  Paper, InputAdornment, Collapse, List, ListItem, ListItemButton, ListItemText,
} from '@mui/material'
import { RefreshIcon, ClearIcon, SearchIcon } from '../icons'
import type { GraphNode, GraphFilters } from '../types'
import { NODE_COLORS, LINK_COLORS } from '../theme'
import GraphSummaryPanel from './GraphSummaryPanel'

interface Props {
  selectedNode:    GraphNode | null
  onClearSelected: () => void
  onFocusNode:     (nodeId: string) => void
  onNodeSelect:    (node: GraphNode) => void
  onResetGraph:    () => void
  filters:         GraphFilters
  onFiltersChange: (f: Partial<GraphFilters>) => void
  totalNodes:      number
  totalLinks:      number
  loading:         boolean
}

const ENTITY_TYPES = ['ALL', 'PERSON', 'ORGANIZATION', 'PROPERTY', 'DOCUMENT', 'DEAL', 'MEETING']

const PREDICATE_GROUPS: Record<string, string[]> = {
  'Employment':  ['EMPLOYED_BY'],
  'Ownership':   ['OWNS', 'MANAGED_BY'],
  'Legal':       ['GOVERNED_BY', 'COUNSEL_FOR', 'SIGNATORY_OF', 'GOVERNS'],
  'Deals':       ['REPRESENTS', 'LENDS_TO', 'GUARANTEES', 'MANAGES', 'LICENSES_TO'],
  'Financial':   ['FINANCED_BY'],
  'Structure':   ['MEMBER_OF', 'PARTNER_OF', 'REGISTERED_IN'],
  'Comms':       ['SENT_TO', 'REFERENCES', 'MENTIONS'],
  'Meetings':    ['ATTENDED', 'ORGANIZED', 'ASSIGNED_TO'],
}

const DOC_TYPE_LABELS: Record<string, string> = {
  LP_AGREEMENT:        'LP Agreement',
  OPERATING_AGREEMENT: 'Operating Agmt',
  LOAN_AGREEMENT:      'Loan Agreement',
  GUARANTY:            'Guaranty',
  UCC_FILING:          'UCC Filing',
  DEED_OF_TRUST:       'Deed of Trust',
  CONSENT_AMENDMENT:   'Consent/Amend',
  ASSIGNMENT:          'Assignment',
  DACA:                'DACA',
  FRANCHISE:           'Franchise',
  ENVIRONMENTAL:       'Environmental',
  CLOSING_DOC:         'Closing Doc',
  TITLE_SURVEY:        'Title/Survey',
  INSURANCE:           'Insurance',
  SNDA:                'SNDA',
  MGMT_AGREEMENT:      'Mgmt Agreement',
  OTHER:               'Other',
}

export default function GraphSidebar({
  selectedNode, onClearSelected, onFocusNode, onNodeSelect,
  onResetGraph, filters, onFiltersChange,
  totalNodes, totalLinks, loading,
}: Props) {
  const [docTypes,      setDocTypes]      = useState<{doc_type: string, count: number}[]>([])
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/entities/search?q=${encodeURIComponent(q)}&limit=8`)
        if (res.ok) setSearchResults(await res.json())
      } catch { /* ignore */ } finally { setSearchLoading(false) }
    }, 280)
  }, [])

  useEffect(() => {
    fetch('/api/documents/types')
      .then(r => r.json())
      .then(data => setDocTypes(data))
      .catch(() => {})
  }, [])

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <Box sx={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden', height: '100%' }}>

      {/* TOP: stats + search — fixed */}
      <Box sx={{ p: 2, pb: 1, flexShrink: 0 }}>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Graph</Typography>
          <Stack direction="row" gap={1} mt={0.5} flexWrap="wrap">
            <Chip label={`${totalNodes} nodes`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }} />
            <Chip label={`${totalLinks} edges`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }} />
            {loading && <CircularProgress size={14} sx={{ color: 'primary.main', mt: 0.5 }} />}
          </Stack>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        <TextField
          size="small" fullWidth placeholder="Search nodes..."
          value={searchQuery} onChange={e => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (<InputAdornment position="start">{searchLoading ? <CircularProgress size={12} /> : <SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} />}</InputAdornment>),
            endAdornment: searchQuery ? (<InputAdornment position="end"><ClearIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'pointer' }} onClick={() => { setSearchQuery(''); setSearchResults([]) }} /></InputAdornment>) : null,
          }}
          sx={{ '& .MuiInputBase-root': { fontSize: '0.78rem' } }}
        />
        {searchResults.length > 0 && (
          <Paper elevation={2} sx={{ mt: 0.5, maxHeight: 220, overflowY: 'auto', bgcolor: 'background.paper' }}>
            <List dense disablePadding>
              {searchResults.map(node => (
                <ListItem key={node.id} disablePadding>
                  <ListItemButton dense onClick={() => { onNodeSelect(node); onFocusNode(node.id); setSearchQuery(''); setSearchResults([]) }} sx={{ py: 0.5, px: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: NODE_COLORS[node.type] ?? '#888', flexShrink: 0, mr: 1 }} />
                    <ListItemText primary={node.name} secondary={node.doc_type ?? node.type} primaryTypographyProps={{ fontSize: '0.72rem', noWrap: true }} secondaryTypographyProps={{ fontSize: '0.62rem' }} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      {/* MIDDLE: Summary or Selected — fills space */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedNode ? (
          <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Selected Actor</Typography>
              <Button size="small" onClick={onClearSelected} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.65rem', textTransform: 'none', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.12)', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'text.primary' } }}>Clear</Button>
            </Box>
            <Paper elevation={0} sx={{ p: 1.5, bgcolor: selectedNode.type === 'PERSON' ? 'rgba(127,119,221,0.08)' : 'rgba(29,158,117,0.08)', border: '1px solid', borderColor: selectedNode.type === 'PERSON' ? 'rgba(127,119,221,0.25)' : 'rgba(29,158,117,0.25)', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: NODE_COLORS[selectedNode.type] ?? '#888', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3, fontSize: '0.82rem' }}>{selectedNode.name}</Typography>
              </Box>
              <Stack direction="row" gap={0.5} flexWrap="wrap" mb={0.75}>
                <Chip label={selectedNode.type} size="small" sx={{ fontSize: '0.62rem', height: 18, bgcolor: `${NODE_COLORS[selectedNode.type] ?? '#888'}22`, color: NODE_COLORS[selectedNode.type] ?? '#888' }} />
                {selectedNode.role_type && <Chip label={selectedNode.role_type} size="small" sx={{ fontSize: '0.62rem', height: 18 }} />}
                {selectedNode.org_type  && <Chip label={selectedNode.org_type}  size="small" sx={{ fontSize: '0.62rem', height: 18 }} />}
              </Stack>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Connections</Typography>
                <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>{selectedNode.val}</Typography>
              </Box>
              {selectedNode.first_seen && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>First seen: {new Date(selectedNode.first_seen).toLocaleDateString()}</Typography>
              )}
              <Button size="small" fullWidth variant="outlined" onClick={() => onFocusNode(selectedNode.id)} sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.4, borderColor: 'rgba(127,119,221,0.3)', color: 'primary.main', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(127,119,221,0.08)' } }}>
                Focus subgraph
              </Button>
            </Paper>
          </Box>
        ) : (
          <GraphSummaryPanel onFocusNode={onFocusNode} />
        )}
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      {/* BOTTOM: Graph Settings — collapsible */}
      <Box sx={{ flexShrink: 0 }}>
        <Box onClick={() => setSettingsOpen(o => !o)} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Graph Settings</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>{settingsOpen ? '▲' : '▼'}</Typography>
        </Box>
        {settingsOpen && (
          <Box sx={{ overflowY: 'auto', maxHeight: 420, px: 2, pb: 2 }}>
            <Stack gap={1.5}>

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Node type</Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {ENTITY_TYPES.map(t => (
                    <Chip key={t} label={t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()} size="small" onClick={() => onFiltersChange({ entity_type: t === 'ALL' ? null : t })}
                      sx={{ fontSize: '0.65rem', height: 20, cursor: 'pointer', bgcolor: (filters.entity_type ?? 'ALL') === t ? `${NODE_COLORS[t] ?? 'rgba(127,119,221,1)'}33` : 'rgba(255,255,255,0.04)', color: (filters.entity_type ?? 'ALL') === t ? NODE_COLORS[t] ?? 'primary.main' : 'text.secondary', border: '1px solid', borderColor: (filters.entity_type ?? 'ALL') === t ? `${NODE_COLORS[t] ?? 'rgba(127,119,221,1)'}55` : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
                    />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Source</Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {[{ key: 'EMAIL', label: 'Emails', color: '#BA7517' }, { key: 'DOCUMENT', label: 'Docs', color: '#7F77DD' }, { key: 'MEETING', label: 'Meetings', color: '#2B8FD4' }].map(({ key, label, color }) => {
                    const active = filters.source_types.includes(key)
                    return (
                      <Chip key={key} label={label} size="small"
                        onClick={() => { const next = active ? filters.source_types.filter(s => s !== key) : [...filters.source_types, key]; if (next.length > 0) onFiltersChange({ source_types: next }) }}
                        sx={{ fontSize: '0.65rem', height: 20, cursor: 'pointer', bgcolor: active ? `${color}33` : 'rgba(255,255,255,0.04)', color: active ? color : 'text.secondary', border: '1px solid', borderColor: active ? `${color}55` : 'transparent', '&:hover': { bgcolor: active ? `${color}44` : 'rgba(255,255,255,0.07)' } }}
                      />
                    )
                  })}
                </Stack>
              </Box>

              {filters.source_types.includes('DOCUMENT') && docTypes.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.6rem' }}>Doc Type</Typography>
                  <Stack direction="row" gap={0.5} flexWrap="wrap" mt={0.5}>
                    {docTypes.map(({ doc_type, count }) => {
                      const active = (filters.doc_types ?? []).includes(doc_type)
                      return (
                        <Chip key={doc_type} label={`${DOC_TYPE_LABELS[doc_type] ?? doc_type} (${count})`} size="small"
                          onClick={() => { const next = active ? (filters.doc_types ?? []).filter(d => d !== doc_type) : [...(filters.doc_types ?? []), doc_type]; onFiltersChange({ doc_types: next.length > 0 ? next : null }) }}
                          sx={{ fontSize: '0.6rem', height: 18, cursor: 'pointer', bgcolor: active ? 'rgba(123,104,238,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#9D8FEE' : 'text.secondary', border: '1px solid', borderColor: active ? 'rgba(123,104,238,0.4)' : 'transparent', '&:hover': { bgcolor: active ? 'rgba(123,104,238,0.3)' : 'rgba(255,255,255,0.07)' } }}
                        />
                      )
                    })}
                  </Stack>
                </Box>
              )}

              <TextField label="From date" type="date" size="small" value={filters.from_date ?? ''} onChange={e => onFiltersChange({ from_date: e.target.value || null })} InputLabelProps={{ shrink: true }} sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }} />
              <TextField label="To date"   type="date" size="small" value={filters.to_date ?? ''}   onChange={e => onFiltersChange({ to_date:   e.target.value || null })} InputLabelProps={{ shrink: true }} sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }} />

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Relationships to display: {filters.limit.toLocaleString()}</Typography>
                <Slider size="small" min={100} max={10000} step={100} value={filters.limit} onChange={(_, v) => onFiltersChange({ limit: v as number })} sx={{ color: 'primary.main', mt: 0.5 }} />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Max hops from selected: {filters.max_hops === 0 ? 'Any' : filters.max_hops}</Typography>
                <Slider size="small" min={0} max={5} step={1} value={filters.max_hops} onChange={(_, v) => onFiltersChange({ max_hops: v as number })} marks={[{ value: 0, label: 'Any' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }]} sx={{ color: 'primary.main', mt: 0.5, '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: 'text.secondary' } }} />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Network density: {filters.min_connections === 1 ? '0%' : `${Math.round((filters.min_connections - 1) / 19 * 100)}%`}</Typography>
                <Slider size="small" min={1} max={20} step={1} value={filters.min_connections} onChange={(_, v) => onFiltersChange({ min_connections: v as number })} marks={[{ value: 1, label: '0%' }, { value: 11, label: '50%' }, { value: 20, label: '100%' }]} sx={{ color: 'primary.main', mt: 0.5, '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: 'text.secondary' } }} />
              </Box>

              <Button size="small" startIcon={<RefreshIcon />} onClick={onResetGraph} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>Reset graph</Button>

              <Divider />

              <Box>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Node types</Typography>
                <Stack gap={0.75} mt={1}>
                  {Object.entries(NODE_COLORS).map(([type, color]) => (
                    <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>{type.toLowerCase()}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Edge types</Typography>
                <Stack gap={1} mt={1}>
                  {Object.entries(PREDICATE_GROUPS).map(([group, preds]) => (
                    <Box key={group}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', opacity: 0.6, display: 'block', mb: 0.25 }}>{group}</Typography>
                      <Stack gap={0.4}>
                        {preds.map(pred => (
                          <Box key={pred} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 0.5 }}>
                            <Box sx={{ width: 14, height: 1.5, flexShrink: 0, bgcolor: LINK_COLORS[pred] ?? 'rgba(136,135,128,0.3)' }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.67rem' }}>{pred.replace(/_/g, ' ').toLowerCase()}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>

            </Stack>
          </Box>
        )}
      </Box>

    </Box>
  )
}
