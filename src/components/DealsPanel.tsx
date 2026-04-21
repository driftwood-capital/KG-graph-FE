import { useEffect, useState, useMemo } from 'react'
import {
  Box, Typography, Chip, CircularProgress, TextField,
  InputAdornment, Stack, Drawer, IconButton, Divider,
  ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material'
import SearchIcon    from '@mui/icons-material/Search'
import CloseIcon     from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { fetchDeals } from '../api'
import DealDetailPanel from './DealDetailPanel'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DealSummary {
  deal_id:        string
  name:           string
  deal_type:      string
  status:         string
  close_date:     string | null
  projected_exit: string | null
  fund_code:      string
  asset_count:    number
  irr:            number | null
  em:             number | null
  fmv:            number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  FUND:          '#2B8FD4',
  EQUITY_ROLLUP: '#7F77DD',
  DEVELOPMENT:   '#E8A838',
  SINGLE_ASSET:  '#1D9E75',
  CREDIT:        '#D85A30',
}
const TYPE_LABELS: Record<string, string> = {
  FUND:          'Fund',
  EQUITY_ROLLUP: 'Portfolio',
  DEVELOPMENT:   'Development',
  SINGLE_ASSET:  'Single Asset',
  CREDIT:        'Credit',
}
const FUND_CODES = ['All', 'DAD', 'DAP', 'DDP', 'DHP', 'DLP', 'JV', 'Legacy', 'DFSCP']

function fmtPct(v?: number | null) {
  if (v == null) return null
  return `${(v * 100).toFixed(1)}%`
}
function fmtX(v?: number | null) {
  if (v == null) return null
  return `${v.toFixed(2)}x`
}
function fmtM(v?: number | null) {
  if (v == null) return null
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

// ── Deal Card ─────────────────────────────────────────────────────────────────
function DealCard({ deal, onClick }: { deal: DealSummary; onClick: () => void }) {
  const color  = TYPE_COLORS[deal.deal_type] ?? '#888'
  const label  = TYPE_LABELS[deal.deal_type]  ?? deal.deal_type
  const irr    = fmtPct(deal.irr)
  const em     = fmtX(deal.em)
  const fmv    = fmtM(deal.fmv)
  const year   = deal.close_date?.slice(0, 4) ?? null

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5, borderRadius: 1.5, cursor: 'pointer',
        border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: `${color}55`,
          bgcolor: `${color}08`,
          transform: 'translateY(-1px)',
          boxShadow: `0 4px 12px ${color}22`,
        },
      }}
    >
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{
            fontWeight: 600, fontSize: '0.75rem', color: 'text.primary',
            display: 'block', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {deal.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4, flexShrink: 0 }}>
          <Chip
            label={label}
            size="small"
            sx={{
              height: 16, fontSize: '0.58rem',
              bgcolor: `${color}22`, color,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          {deal.fund_code && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              {deal.fund_code}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Metrics row */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        {[
          { label: 'IRR', value: irr },
          { label: 'EM',  value: em  },
          { label: 'FMV', value: fmv },
        ].map(({ label: ml, value }) => value ? (
          <Box key={ml} sx={{
            flex: 1, textAlign: 'center', py: 0.4,
            borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', display: 'block' }}>
              {ml}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
        ) : null)}
      </Box>

      {/* Footer row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
          {year ? `Close ${year}` : 'No close date'}
          {deal.asset_count > 0 ? `  ·  ${deal.asset_count} asset${deal.asset_count > 1 ? 's' : ''}` : ''}
        </Typography>
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: deal.status === 'ACTIVE' ? '#1D9E75' : deal.status === 'EXITED' ? '#888' : '#BA7517',
        }} />
      </Box>
    </Box>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function DealsPanel() {
  const [deals,       setDeals]       = useState<DealSummary[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState<string>('ALL')
  const [fundFilter,  setFundFilter]  = useState<string>('All')
  const [selectedId,  setSelectedId]  = useState<string | null>(null)

  useEffect(() => {
    fetchDeals()
      .then(d => { setDeals(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (typeFilter !== 'ALL' && d.deal_type !== typeFilter) return false
      if (fundFilter !== 'All' && !d.fund_code.includes(fundFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!d.name.toLowerCase().includes(q) && !d.fund_code.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [deals, typeFilter, fundFilter, search])

  // Stats
  const totalFMV    = filtered.reduce((s, d) => s + (d.fmv ?? 0), 0)
  const avgIRR      = filtered.filter(d => d.irr).reduce((s, d) => s + (d.irr ?? 0), 0) / (filtered.filter(d => d.irr).length || 1)
  const activeCount = filtered.filter(d => d.status === 'ACTIVE').length

  const selectedDeal = deals.find(d => d.deal_id === selectedId) ?? null

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <CircularProgress size={28} />
    </Box>
  )
  if (error) return (
    <Box sx={{ p: 3 }}>
      <Typography color="error">{error}</Typography>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
            Deals
          </Typography>

          {/* Summary chips */}
          <Stack direction="row" gap={1} sx={{ ml: 1 }}>
            <Chip label={`${filtered.length} deals`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.7rem' }} />
            {activeCount > 0 && <Chip label={`${activeCount} active`} size="small" sx={{ bgcolor: 'rgba(29,158,117,0.15)', color: '#1D9E75', fontSize: '0.7rem' }} />}
            {totalFMV > 0 && <Chip label={`${fmtM(totalFMV)} FMV`} size="small" sx={{ bgcolor: 'rgba(232,168,56,0.15)', color: '#E8A838', fontSize: '0.7rem' }} />}
            {avgIRR > 0 && <Chip label={`${(avgIRR * 100).toFixed(1)}% avg IRR`} size="small" sx={{ bgcolor: 'rgba(127,119,221,0.15)', color: '#7F77DD', fontSize: '0.7rem' }} />}
          </Stack>

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search deals…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} /></InputAdornment>,
            }}
            sx={{ ml: 'auto', width: 220, '& .MuiInputBase-root': { fontSize: '0.78rem' } }}
          />
        </Box>

        {/* Filter row */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Deal type filter */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {['ALL', 'FUND', 'EQUITY_ROLLUP', 'DEVELOPMENT', 'SINGLE_ASSET', 'CREDIT'].map(t => (
              <Chip
                key={t}
                label={t === 'ALL' ? 'All Types' : TYPE_LABELS[t]}
                size="small"
                onClick={() => setTypeFilter(t)}
                sx={{
                  height: 22, fontSize: '0.65rem', cursor: 'pointer',
                  bgcolor: typeFilter === t ? `${TYPE_COLORS[t] ?? 'rgba(127,119,221,1)'}33` : 'rgba(255,255,255,0.04)',
                  color:   typeFilter === t ? TYPE_COLORS[t] ?? 'primary.main' : 'text.secondary',
                  border: '1px solid',
                  borderColor: typeFilter === t ? `${TYPE_COLORS[t] ?? 'rgba(127,119,221,1)'}55` : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              />
            ))}
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Fund filter */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {FUND_CODES.map(f => (
              <Chip
                key={f}
                label={f}
                size="small"
                onClick={() => setFundFilter(f)}
                sx={{
                  height: 22, fontSize: '0.65rem', cursor: 'pointer',
                  bgcolor: fundFilter === f ? 'rgba(127,119,221,0.2)' : 'rgba(255,255,255,0.04)',
                  color:   fundFilter === f ? '#9D8FEE' : 'text.secondary',
                  border: '1px solid',
                  borderColor: fundFilter === f ? 'rgba(127,119,221,0.4)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Card grid ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 6 }}>
            <Typography variant="caption" color="text.disabled">No deals match your filters</Typography>
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 1.5,
          }}>
            {filtered.map(deal => (
              <DealCard
                key={deal.deal_id}
                deal={deal}
                onClick={() => setSelectedId(deal.deal_id)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Detail drawer ── */}
      <Drawer
        anchor="right"
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        PaperProps={{
          sx: {
            width: 480,
            bgcolor: 'background.default',
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {selectedDeal && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Drawer header */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TYPE_COLORS[selectedDeal.deal_type] ?? '#888', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, flex: 1, fontSize: '0.78rem', color: 'text.primary' }}>
                {selectedDeal.name}
              </Typography>
              <Tooltip title="Open in graph">
                <IconButton size="small" onClick={() => window.open(`/?focus=${selectedDeal.deal_id}`, '_blank')}>
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setSelectedId(null)}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>

            {/* Deal detail panel — reuse existing component */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <DealDetailPanel dealId={selectedId!} />
            </Box>
          </Box>
        )}
      </Drawer>

    </Box>
  )
}
