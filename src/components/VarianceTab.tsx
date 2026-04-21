import { useEffect, useState } from 'react'
import {
  Box, Typography, CircularProgress, Alert, Chip,
  Table, TableBody, TableRow, TableCell, TableHead,
  Tooltip, Divider,
} from '@mui/material'
import TrendingUpIcon   from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import RemoveIcon       from '@mui/icons-material/Remove'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetricRow {
  metric:         string
  label:          string
  actual:         number
  actual_fmt:     string
  projected:      number | null
  projected_fmt:  string | null
  variance_pct:   number | null
  variance_fmt:   string
  status:         'ok' | 'warn' | 'alert' | 'no_projection'
  beating:        boolean | null
}

interface PropertyResult {
  property_id:     string
  property_name:   string
  latest_period:   string
  period_count:    number
  metrics:         MetricRow[]
  ttm: {
    revpar:        number | null
    occupancy_pct: number | null
    total_revenue: number | null
    period_count:  number
  }
  has_projection: boolean
}

interface ReconciliationData {
  deal_id:           string
  deal_name:         string
  deal_type:         string
  close_date:        string | null
  has_portfolio_pl:  boolean
  properties:        PropertyResult[]
  summary: {
    total_properties:         number
    properties_with_actuals:  number
    alerts:   number
    warnings: number
    on_track: number
    overall_status: 'ok' | 'warn' | 'alert'
  }
  message?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  ok:            '#1D9E75',
  warn:          '#E8A838',
  alert:         '#D85A30',
  no_projection: '#888888',
}

const STATUS_BG = {
  ok:            'rgba(29,158,117,0.08)',
  warn:          'rgba(232,168,56,0.1)',
  alert:         'rgba(216,90,48,0.1)',
  no_projection: 'rgba(136,136,136,0.05)',
}

function StatusDot({ status }: { status: string }) {
  return (
    <Box sx={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      bgcolor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#888',
    }} />
  )
}

function VarianceChip({ row }: { row: MetricRow }) {
  if (row.status === 'no_projection') {
    return <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>No UW</Typography>
  }

  const color = STATUS_COLORS[row.status]
  const Icon  = row.beating === true ? TrendingUpIcon : row.beating === false ? TrendingDownIcon : RemoveIcon

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
      <Icon sx={{ fontSize: 11, color }} />
      <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 600, color }}>
        {row.variance_fmt}
      </Typography>
    </Box>
  )
}

// ── Property Card ─────────────────────────────────────────────────────────────
function PropertyVarianceCard({ prop }: { prop: PropertyResult }) {
  const worstStatus = prop.metrics.reduce((worst, m) => {
    const order = { alert: 0, warn: 1, ok: 2, no_projection: 3 }
    return order[m.status as keyof typeof order] < order[worst as keyof typeof order] ? m.status : worst
  }, 'no_projection' as string)

  const color = STATUS_COLORS[worstStatus as keyof typeof STATUS_COLORS] ?? '#888'

  return (
    <Box sx={{
      mb: 1.5, borderRadius: 1.5,
      border: '1px solid', borderColor: `${color}33`,
      bgcolor: STATUS_BG[worstStatus as keyof typeof STATUS_BG] ?? 'transparent',
      overflow: 'hidden',
    }}>
      {/* Property header */}
      <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <StatusDot status={worstStatus} />
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', flex: 1, color: 'text.primary' }}>
          {prop.property_name}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
          {prop.latest_period || '—'}  ·  {prop.period_count} month{prop.period_count !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Metrics table */}
      {prop.metrics.length > 0 ? (
        <Table size="small" sx={{ '& .MuiTableCell-root': { border: 'none', py: 0.4, px: 1.5 } }}>
          <TableHead>
            <TableRow>
              {['Metric', 'Actual', 'UW Projection', 'Variance'].map(h => (
                <TableCell key={h} sx={{ fontSize: '0.58rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {prop.metrics.map(m => (
              <TableRow key={m.metric} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <TableCell sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{m.label}</TableCell>
                <TableCell sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.primary' }}>{m.actual_fmt}</TableCell>
                <TableCell sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{m.projected_fmt ?? '—'}</TableCell>
                <TableCell><VarianceChip row={m} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" color="text.disabled">No metric data available</Typography>
        </Box>
      )}

      {/* TTM summary bar */}
      {(prop.ttm.revpar || prop.ttm.occupancy_pct) && (
        <Box sx={{ px: 1.5, py: 0.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2 }}>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', mr: 0.5 }}>
            TTM ({prop.ttm.period_count}mo)
          </Typography>
          {prop.ttm.occupancy_pct != null && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              Occ {(prop.ttm.occupancy_pct * 100).toFixed(1)}%
            </Typography>
          )}
          {prop.ttm.revpar != null && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              RevPAR ${prop.ttm.revpar.toFixed(0)}
            </Typography>
          )}
          {prop.ttm.total_revenue != null && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              Rev {prop.ttm.total_revenue >= 1_000_000
                ? `$${(prop.ttm.total_revenue / 1_000_000).toFixed(1)}M`
                : `$${(prop.ttm.total_revenue / 1_000).toFixed(0)}K`}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VarianceTab({ dealId }: { dealId: string }) {
  const [data,    setData]    = useState<ReconciliationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!dealId) return
    setLoading(true)
    fetch(`/api/deals/${dealId}/reconciliation`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dealId])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      <CircularProgress size={20} />
    </Box>
  )
  if (error) return (
    <Alert severity="error" sx={{ m: 1, fontSize: '0.72rem' }}>{error}</Alert>
  )
  if (!data) return null

  if (data.message) return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.disabled">{data.message}</Typography>
    </Box>
  )

  const { summary } = data
  const overallColor = STATUS_COLORS[summary.overall_status]

  return (
    <Box sx={{ p: 1.5 }}>

      {/* Summary strip */}
      <Box sx={{
        display: 'flex', gap: 1, mb: 1.5, p: 1,
        borderRadius: 1, border: '1px solid', borderColor: `${overallColor}33`,
        bgcolor: `${overallColor}08`,
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
          <StatusDot status={summary.overall_status} />
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', color: overallColor }}>
            {summary.overall_status === 'ok' ? 'On Track' : summary.overall_status === 'warn' ? 'Needs Attention' : 'Off Track'}
          </Typography>
        </Box>
        {summary.alerts > 0 && (
          <Chip label={`${summary.alerts} alert${summary.alerts > 1 ? 's' : ''}`} size="small"
            sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(216,90,48,0.15)', color: '#D85A30', '& .MuiChip-label': { px: 0.75 } }} />
        )}
        {summary.warnings > 0 && (
          <Chip label={`${summary.warnings} warning${summary.warnings > 1 ? 's' : ''}`} size="small"
            sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(232,168,56,0.15)', color: '#E8A838', '& .MuiChip-label': { px: 0.75 } }} />
        )}
        {summary.on_track > 0 && (
          <Chip label={`${summary.on_track} on track`} size="small"
            sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(29,158,117,0.15)', color: '#1D9E75', '& .MuiChip-label': { px: 0.75 } }} />
        )}
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          {summary.properties_with_actuals} of {summary.total_properties} properties
          {!data.has_portfolio_pl && ' · No P&L projection in UW model'}
        </Typography>
      </Box>

      {/* Property cards — sorted alerts first */}
      {data.properties.map(prop => (
        <PropertyVarianceCard key={prop.property_id} prop={prop} />
      ))}

    </Box>
  )
}
