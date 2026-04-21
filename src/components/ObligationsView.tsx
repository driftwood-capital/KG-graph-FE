import { useEffect, useState } from 'react'
import {
  Box, Typography, Chip, Stack, Divider,
  CircularProgress, Paper, Select,
  MenuItem, FormControl, InputLabel, TextField,
  InputAdornment, IconButton,
} from '@mui/material'
import { WarningAmberIcon, CheckCircleOutlineIcon, ErrorOutlineIcon, SearchIcon, CloseIcon } from '../icons'
import axios from 'axios'
import dayjs from 'dayjs'

interface Obligation {
  obligation_id        : string
  obligation_type      : string
  description          : string | null
  entity_name          : string | null
  due_date             : string | null
  alert_date           : string | null
  status               : string
  source_email_subject : string | null
  days_until_due       : number | null
  tags                 : string[]
  priority             : string | null
  assigned_to          : string | null
  amount               : number | null
  recurrence           : string | null
  extension_options    : string[]
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  // Lending
  LOAN_MATURITY:            { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  LOAN_EXTENSION_OPTION:    { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  RATE_CAP_EXPIRY:          { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  DEBT_SERVICE_COVERAGE:    { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  INTEREST_RESERVE:         { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  GUARANTY_EXPIRY:          { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  LENDER_APPROVAL:          { bg: 'rgba(127,119,221,0.12)', color: '#AFA9EC' },
  // Development
  CONSTRUCTION_COMPLETION:  { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  CERTIFICATE_OF_OCCUPANCY: { bg: 'rgba(29,158,117,0.12)',  color: '#5DCAA5' },
  BUILDING_PERMIT_EXPIRY:   { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  ENTITLEMENT_EXPIRY:       { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  // Acquisitions
  PSA_CLOSING:              { bg: 'rgba(29,158,117,0.12)',  color: '#5DCAA5' },
  DUE_DILIGENCE_EXPIRY:     { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  EARNEST_MONEY_DEADLINE:   { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  ROFO_ROFR_DEADLINE:       { bg: 'rgba(127,119,221,0.12)', color: '#AFA9EC' },
  // Property ops
  LIQUOR_LICENSE_EXPIRY:    { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  BUSINESS_LICENSE_EXPIRY:  { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  HEALTH_PERMIT_EXPIRY:     { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  FIRE_INSPECTION:          { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  // Insurance
  PROPERTY_INSURANCE_EXPIRY:{ bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  LIABILITY_INSURANCE_EXPIRY:{ bg: 'rgba(153,53,86,0.12)',  color: '#D4537E' },
  // Franchise
  FRANCHISE_AGREEMENT_EXPIRY:{ bg: 'rgba(127,119,221,0.12)',color: '#AFA9EC' },
  PIP_DEADLINE:             { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  COMFORT_LETTER:           { bg: 'rgba(127,119,221,0.12)', color: '#AFA9EC' },
  // Legal
  CONTRACT_DEADLINE:        { bg: 'rgba(186,117,23,0.12)',  color: '#EF9F27' },
  LEGAL_REVIEW:             { bg: 'rgba(127,119,221,0.12)', color: '#AFA9EC' },
  LLC_AMENDMENT:            { bg: 'rgba(127,119,221,0.12)', color: '#AFA9EC' },
  UCC_FILING:               { bg: 'rgba(153,53,86,0.12)',   color: '#D4537E' },
  ACTION_ITEM:              { bg: 'rgba(29,158,117,0.12)',  color: '#5DCAA5' },
  OTHER:                    { bg: 'rgba(136,135,128,0.1)',  color: '#888780' },
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   '#E24B4A',
  MEDIUM: '#EF9F27',
  LOW:    '#5DCAA5',
}

function urgencyLevel(days: number | null, priority: string | null): 'critical' | 'warning' | 'ok' | 'unknown' {
  if (priority === 'HIGH')   return 'critical'
  if (priority === 'MEDIUM') return 'warning'
  if (days === null) return 'unknown'
  if (days < 0)    return 'critical'
  if (days <= 30)  return 'critical'
  if (days <= 90)  return 'warning'
  return 'ok'
}

function UrgencyIcon({ days, priority }: { days: number | null; priority: string | null }) {
  const level = urgencyLevel(days, priority)
  if (level === 'critical') return <ErrorOutlineIcon sx={{ fontSize: 14, color: '#E24B4A' }} />
  if (level === 'warning')  return <WarningAmberIcon sx={{ fontSize: 14, color: '#EF9F27' }} />
  if (level === 'ok')       return <CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#5DCAA5' }} />
  return null
}

// Group obligations by category
const TYPE_GROUPS: Record<string, string[]> = {
  'Lending':     ['LOAN_MATURITY','LOAN_EXTENSION_OPTION','RATE_CAP_EXPIRY','DEBT_SERVICE_COVERAGE','INTEREST_RESERVE','GUARANTY_EXPIRY','LENDER_APPROVAL','LOAN_ASSUMPTION','PREFERRED_RETURN'],
  'Development': ['CONSTRUCTION_COMPLETION','CERTIFICATE_OF_OCCUPANCY','BUILDING_PERMIT_EXPIRY','ENTITLEMENT_EXPIRY','CONTRACTOR_NOTICE','PUNCH_LIST_DEADLINE','RETAINAGE_RELEASE'],
  'Acquisitions':['PSA_CLOSING','DUE_DILIGENCE_EXPIRY','EARNEST_MONEY_DEADLINE','ROFO_ROFR_DEADLINE','OPTION_EXERCISE','TITLE_COMMITMENT_EXPIRY'],
  'Operations':  ['LIQUOR_LICENSE_EXPIRY','BUSINESS_LICENSE_EXPIRY','HEALTH_PERMIT_EXPIRY','FIRE_INSPECTION','ELEVATOR_INSPECTION','FOOD_SERVICE_PERMIT','SHORT_TERM_RENTAL_PERMIT'],
  'Insurance':   ['PROPERTY_INSURANCE_EXPIRY','LIABILITY_INSURANCE_EXPIRY','WORKERS_COMP_EXPIRY','DIRECTORS_OFFICERS_EXPIRY','FLOOD_INSURANCE_EXPIRY'],
  'Franchise':   ['FRANCHISE_AGREEMENT_EXPIRY','FRANCHISE_RENEWAL_DEADLINE','PIP_DEADLINE','BRAND_AUDIT','FF_E_RESERVE','COMFORT_LETTER'],
  'Legal':       ['LLC_AMENDMENT','TAX_FILING','SEC_FILING','ENVIRONMENTAL_REMEDIATION','ZONING_COMPLIANCE','UCC_FILING','CONTRACT_DEADLINE','LEGAL_REVIEW','NOTICE_PERIOD'],
  'Actions':     ['ACTION_ITEM'],
  'Other':       ['OTHER'],
}

function getGroupForType(type: string): string {
  for (const [group, types] of Object.entries(TYPE_GROUPS)) {
    if (types.includes(type)) return group
  }
  return 'Other'
}

export default function ObligationsView() {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading]         = useState(true)
  const [typeFilter, setTypeFilter]   = useState<string>('ALL')
  const [tagSearch, setTagSearch]     = useState('')
  const [selected, setSelected]       = useState<Obligation | null>(null)

  useEffect(() => {
    setLoading(true)
    axios.get('/api/obligations', { params: { status: 'ACTIVE' } })
      .then(r => setObligations(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Collect all unique tags
  const allTags = Array.from(new Set(obligations.flatMap(o => o.tags || []))).sort()
  const typeGroups = ['ALL', ...Object.keys(TYPE_GROUPS)]

  // Filter
  const filtered = obligations.filter(o => {
    if (typeFilter !== 'ALL') {
      const group = getGroupForType(o.obligation_type)
      if (group !== typeFilter && o.obligation_type !== typeFilter) return false
    }
    if (tagSearch.trim()) {
      const q = tagSearch.toLowerCase()
      const matchesTag = (o.tags || []).some(t => t.toLowerCase().includes(q))
      const matchesDesc = (o.description || '').toLowerCase().includes(q)
      const matchesEntity = (o.entity_name || '').toLowerCase().includes(q)
      if (!matchesTag && !matchesDesc && !matchesEntity) return false
    }
    return true
  })

  // Group by urgency
  const critical = filtered.filter(o => urgencyLevel(o.days_until_due, o.priority) === 'critical')
  const warning  = filtered.filter(o => urgencyLevel(o.days_until_due, o.priority) === 'warning')
  const ok       = filtered.filter(o => urgencyLevel(o.days_until_due, o.priority) === 'ok')
  const unknown  = filtered.filter(o => urgencyLevel(o.days_until_due, o.priority) === 'unknown')

  const ObligationCard = ({ o }: { o: Obligation }) => {
    const typeStyle = TYPE_COLORS[o.obligation_type] ?? TYPE_COLORS.OTHER
    const level     = urgencyLevel(o.days_until_due, o.priority)
    const isSelected = selected?.obligation_id === o.obligation_id

    return (
      <Paper
        elevation={0}
        onClick={() => setSelected(isSelected ? null : o)}
        sx={{
          p: 1.5, mb: 0.75, cursor: 'pointer',
          border: '1px solid',
          borderColor: isSelected ? 'rgba(127,119,221,0.4)' : 'rgba(255,255,255,0.06)',
          bgcolor: isSelected ? 'rgba(127,119,221,0.06)' : 'rgba(255,255,255,0.02)',
          '&:hover': { borderColor: 'rgba(255,255,255,0.12)', bgcolor: 'rgba(255,255,255,0.03)' },
          transition: 'all 0.15s ease',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
            <UrgencyIcon days={o.days_until_due} priority={o.priority} />
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', fontSize: '0.78rem', lineHeight: 1.3 }}>
              {o.entity_name ?? 'Unknown entity'}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.5} alignItems="center" flexShrink={0} ml={0.5}>
            {o.priority && (
              <Chip
                label={o.priority}
                size="small"
                sx={{ fontSize: '0.58rem', height: 16,
                  bgcolor: `${PRIORITY_COLORS[o.priority] ?? '#888'}22`,
                  color: PRIORITY_COLORS[o.priority] ?? '#888' }}
              />
            )}
            <Chip
              label={o.obligation_type.replace(/_/g, ' ')}
              size="small"
              sx={{ bgcolor: typeStyle.bg, color: typeStyle.color, fontSize: '0.62rem', height: 18 }}
            />
          </Stack>
        </Box>

        {o.description && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, lineHeight: 1.5 }}>
            {o.description.length > 130 ? o.description.slice(0, 128) + '…' : o.description}
          </Typography>
        )}

        {/* Tags */}
        {(o.tags || []).length > 0 && (
          <Stack direction="row" gap={0.4} mb={0.75} flexWrap="wrap">
            {o.tags.map((tag, i) => (
              <Chip
                key={i}
                label={`#${tag}`}
                size="small"
                onClick={e => { e.stopPropagation(); setTagSearch(tag) }}
                sx={{ fontSize: '0.6rem', height: 16, bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary',
                  cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'text.primary' } }}
              />
            ))}
          </Stack>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {o.due_date ? (
            <Typography variant="caption" sx={{
              color: level === 'critical' ? '#E24B4A' : level === 'warning' ? '#EF9F27' : 'text.secondary',
              fontWeight: level !== 'ok' ? 600 : 400,
            }}>
              Due: {dayjs(o.due_date).format('MMM D, YYYY')}
              {o.days_until_due !== null && (
                <span style={{ marginLeft: 6, opacity: 0.8 }}>
                  ({o.days_until_due < 0
                    ? `${Math.abs(o.days_until_due)}d overdue`
                    : `${o.days_until_due}d`})
                </span>
              )}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>No due date</Typography>
          )}
          {o.amount && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ${o.amount.toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Expanded detail */}
        {isSelected && (
          <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {o.alert_date && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Alert date: {dayjs(o.alert_date).format('MMM D, YYYY')}
              </Typography>
            )}
            {o.assigned_to && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Assigned to: <span style={{ color: '#AFA9EC' }}>{o.assigned_to}</span>
              </Typography>
            )}
            {o.recurrence && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Recurrence: {o.recurrence}
              </Typography>
            )}
            {(o.extension_options || []).length > 0 && (
              <Box sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Extension options:
                </Typography>
                {o.extension_options.map((d, i) => (
                  <Chip key={i} label={dayjs(d).format('MMM D, YYYY')} size="small"
                    sx={{ fontSize: '0.62rem', height: 18, mr: 0.5, bgcolor: 'rgba(29,158,117,0.1)', color: '#5DCAA5' }} />
                ))}
              </Box>
            )}
            {o.source_email_subject && (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Source:
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.main', lineHeight: 1.4, display: 'block' }}>
                  {o.source_email_subject}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    )
  }

  const Section = ({ title, items, color }: { title: string; items: Obligation[]; color: string }) => {
    if (items.length === 0) return null
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 500 }}>
            {title}
          </Typography>
          <Chip label={items.length} size="small" sx={{ height: 16, fontSize: '0.65rem', bgcolor: `${color}22`, color }} />
        </Box>
        {items.map(o => <ObligationCard key={o.obligation_id} o={o} />)}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '0.9rem', color: 'text.primary' }}>
              Obligations & critical dates
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {obligations.length} active · {filtered.length} shown
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Category</InputLabel>
            <Select value={typeFilter} label="Category" onChange={e => setTypeFilter(e.target.value)} sx={{ fontSize: '0.75rem' }}>
              {typeGroups.map(t => (
                <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem' }}>
                  {t === 'ALL' ? 'All categories' : t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Tag search */}
        <TextField
          fullWidth size="small"
          placeholder="Search by tag, property, or keyword…"
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 13, color: 'text.secondary' }} /></InputAdornment>,
            endAdornment: tagSearch ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setTagSearch('')} sx={{ p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.03)' } }}
        />

        {/* Popular tags */}
        {allTags.length > 0 && !tagSearch && (
          <Stack direction="row" gap={0.5} mt={0.75} flexWrap="wrap">
            {allTags.slice(0, 8).map(tag => (
              <Chip key={tag} label={`#${tag}`} size="small"
                onClick={() => setTagSearch(tag)}
                sx={{ fontSize: '0.6rem', height: 16, cursor: 'pointer',
                  bgcolor: 'rgba(255,255,255,0.04)', color: 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Summary strip */}
      {!loading && obligations.length > 0 && (
        <Box sx={{ px: 2.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1.5 }}>
          {critical.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ErrorOutlineIcon sx={{ fontSize: 13, color: '#E24B4A' }} />
              <Typography variant="caption" sx={{ color: '#E24B4A', fontWeight: 600 }}>{critical.length} critical</Typography>
            </Box>
          )}
          {warning.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningAmberIcon sx={{ fontSize: 13, color: '#EF9F27' }} />
              <Typography variant="caption" sx={{ color: '#EF9F27', fontWeight: 600 }}>{warning.length} within 90 days</Typography>
            </Box>
          )}
          {ok.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 13, color: '#5DCAA5' }} />
              <Typography variant="caption" sx={{ color: '#5DCAA5' }}>{ok.length} on track</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : obligations.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 6 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>No obligations extracted yet</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Obligations are extracted from emails, documents, and meetings during ingest
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 4 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>No results for current filters</Typography>
          </Box>
        ) : (
          <>
            <Section title="Critical / overdue" items={critical} color="#E24B4A" />
            <Section title="Due within 90 days" items={warning}  color="#EF9F27" />
            <Section title="On track"            items={ok}      color="#5DCAA5" />
            <Section title="No due date"         items={unknown} color="#888780" />
          </>
        )}
      </Box>
    </Box>
  )
}
