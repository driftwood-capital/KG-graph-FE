// OAStructureTab.tsx
// Renders inside EntityDetailPanel when node.type === 'DOCUMENT'
// and node.doc_type is LP_AGREEMENT or OPERATING_AGREEMENT.
//
// Place in: src/components/OAStructureTab.tsx

import { useEffect, useState } from 'react'
import {
  Box, Typography, Chip, Divider, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableRow, TableCell,
  Alert, Tooltip, IconButton, Stack,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type {
  OAStructureResponse, OAEntity, OAFee, OAWaterfallTier, OAKeyPerson,
} from '../types'

// ─── helpers ────────────────────────────────────────────────────────────────

const TIER_COLORS = ['#1e3a5f', '#1a5276', '#1d6a4a', '#4a235a']

const roleColor = (role: OAEntity['role']): string => ({
  GENERAL_PARTNER:  '#7b68ee',
  LIMITED_PARTNER:  '#378add',
  HOTEL_OWNER:      '#1d9e75',
  PROPERTY_MANAGER: '#ef9f27',
  LENDER:           '#5f5e5a',
  ADVISOR:          '#888780',
  GUARANTOR:        '#e24b4a',
} as Record<string, string>)[role] ?? '#5f5e5a'

function fmtCurrency(val: number | null | undefined): string | null {
  if (val == null) return null
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`
  return `$${val.toLocaleString()}`
}

function fmtPct(val: number | null | undefined): string | null {
  if (val == null) return null
  return `${val}%`
}

// ─── micro-components ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" sx={{
      color: 'text.disabled', fontSize: '0.6rem', letterSpacing: 1.2,
      display: 'block', mt: 1.5, mb: 0.5,
    }}>
      {children}
    </Typography>
  )
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mr: 1 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ textAlign: 'right', color: 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}

function FlagRow({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
      <WarningAmberIcon sx={{ fontSize: 13, color: '#ef9f27', mt: 0.2, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: '#ef9f27', lineHeight: 1.4 }}>{text}</Typography>
    </Box>
  )
}

// ─── entity card ────────────────────────────────────────────────────────────

function EntityCard({ entity }: { entity: OAEntity }) {
  const color = roleColor(entity.role)
  return (
    <Box sx={{
      border: '1px solid', borderColor: 'divider',
      borderLeft: `3px solid ${color}`,
      borderRadius: 1, p: 1, mb: 0.75,
      bgcolor: 'background.default',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3, flex: 1 }}>
          {entity.name}
        </Typography>
        <Chip
          label={entity.role.replace('_', ' ')}
          size="small"
          sx={{
            height: 15, fontSize: '0.58rem', flexShrink: 0,
            bgcolor: `${color}22`, color, border: `1px solid ${color}44`,
          }}
        />
      </Box>
      {(entity.ownership_pct != null || entity.capital_contribution != null) && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
          {entity.ownership_pct != null ? `${entity.ownership_pct}% interest` : ''}
          {entity.capital_contribution != null
            ? `${entity.ownership_pct != null ? ' · ' : ''}${fmtCurrency(entity.capital_contribution)} capital`
            : ''}
        </Typography>
      )}
      {entity.notes && (
        <Typography variant="caption" color="text.disabled" display="block" sx={{ fontStyle: 'italic' }}>
          {entity.notes}
        </Typography>
      )}
    </Box>
  )
}

// ─── waterfall tier ─────────────────────────────────────────────────────────

function WaterfallTier({ tier, index }: { tier: OAWaterfallTier; index: number }) {
  const irrRange = (() => {
    if (tier.irr_floor == null && tier.irr_ceiling == null) return null
    if (tier.irr_floor == null)    return `IRR < ${tier.irr_ceiling}%`
    if (tier.irr_ceiling == null)  return `IRR ≥ ${tier.irr_floor}%`
    return `${tier.irr_floor}% ≤ IRR < ${tier.irr_ceiling}%`
  })()

  return (
    <Box sx={{
      display: 'flex', alignItems: 'stretch', mb: 0.5,
      borderRadius: 1, overflow: 'hidden',
      border: '1px solid', borderColor: 'divider',
    }}>
      <Box sx={{ width: 3, flexShrink: 0, bgcolor: TIER_COLORS[index % TIER_COLORS.length] }} />
      <Box sx={{ p: 0.75, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {tier.tier}. {tier.label}
          </Typography>
          {irrRange && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
              {irrRange}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {tier.description}
        </Typography>
        {(tier.gp_pct != null || tier.lp_pct != null) && (
          <Stack direction="row" gap={0.75} mt={0.25}>
            {tier.gp_pct != null && (
              <Chip label={`GP ${tier.gp_pct}%`} size="small"
                sx={{ height: 15, fontSize: '0.58rem', bgcolor: '#7b68ee22', color: '#9d8fee' }} />
            )}
            {tier.lp_pct != null && (
              <Chip label={`LP ${tier.lp_pct}%`} size="small"
                sx={{ height: 15, fontSize: '0.58rem', bgcolor: '#378add22', color: '#85b7eb' }} />
            )}
          </Stack>
        )}
      </Box>
    </Box>
  )
}

// ─── fee row ────────────────────────────────────────────────────────────────

function FeeRow({ fee }: { fee: OAFee }) {
  const amount = (() => {
    if (fee.amount_fixed)                        return fmtCurrency(fee.amount_fixed)
    if (fee.amount_pct && fee.floor_amount)
      return `${fmtPct(fee.amount_pct)} gross rev or ${fmtCurrency(fee.floor_amount)}/mo`
    if (fee.amount_pct)
      return `${fmtPct(fee.amount_pct)} of ${fee.basis ?? 'gross rev'}`
    return '—'
  })()

  const label = fee.fee_type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <TableRow sx={{ '&:last-child td': { border: 0 } }}>
      <TableCell sx={{ py: 0.4, px: 0.75, verticalAlign: 'top' }}>
        <Typography variant="caption" sx={{ fontWeight: 500 }}>{label}</Typography>
        {fee.accounting_fee_monthly != null && (
          <Typography variant="caption" color="text.disabled" display="block">
            + {fmtCurrency(fee.accounting_fee_monthly)}/mo accounting
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ py: 0.4, px: 0.75 }}>
        <Typography variant="caption" color="text.secondary">{fee.recipient ?? '—'}</Typography>
      </TableCell>
      <TableCell sx={{ py: 0.4, px: 0.75, textAlign: 'right' }}>
        <Typography variant="caption">{amount}</Typography>
      </TableCell>
    </TableRow>
  )
}

// ─── key persons ────────────────────────────────────────────────────────────

function KeyPersonRow({ person }: { person: OAKeyPerson }) {
  const shortEntity = person.entity
    ? person.entity.split(' ').slice(0, 4).join(' ') + (person.entity.split(' ').length > 4 ? '…' : '')
    : null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant="caption" sx={{ fontWeight: 500 }}>{person.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        {person.title}{shortEntity ? ` · ${shortEntity}` : ''}
      </Typography>
    </Box>
  )
}

// ─── accordion wrapper ──────────────────────────────────────────────────────

function Section({
  label, defaultExpanded = true, children,
}: { label: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  return (
    <Accordion
      disableGutters defaultExpanded={defaultExpanded} elevation={0}
      sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 15 }} />}
        sx={{ px: 0, minHeight: 28, '& .MuiAccordionSummary-content': { my: 0 } }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.5, fontSize: '0.65rem' }}>
          {label}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

// ─── main component ─────────────────────────────────────────────────────────

interface Props {
  documentId: string
}

export default function OAStructureTab({ documentId }: Props) {
  const [data, setData]       = useState<OAStructureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    if (!documentId) return
    setLoading(true)
    setError(null)

    fetch(`/api/documents/${documentId}/structure`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<OAStructureResponse>
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e.message)); setLoading(false) })
  }, [documentId])

  const handleCopy = () => {
    if (!data?.structure) return
    navigator.clipboard.writeText(JSON.stringify(data.structure, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
      <CircularProgress size={22} />
    </Box>
  )

  if (error) return (
    <Alert severity="error" sx={{ m: 1, fontSize: '0.72rem' }}>
      {error}
    </Alert>
  )

  if (!data?.structure) return (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="caption" color="text.disabled">
        {data?.pending
          ? 'OA structure extraction pending — run ingest to process.'
          : 'No structure extracted for this document yet.'}
      </Typography>
    </Box>
  )

  const { structure } = data
  const { deal, entities, loan, fees, waterfall, key_persons, flags } = structure

  return (
    <Box sx={{ px: 1.5, pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 0.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {deal.hotel_name ?? deal.partnership_name ?? 'Operating Agreement'}
          </Typography>
          {deal.hotel_name && deal.partnership_name && (
            <Typography variant="caption" color="text.secondary" display="block">
              {deal.partnership_name}
            </Typography>
          )}
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy JSON'}>
          <IconButton size="small" onClick={handleCopy} sx={{ p: 0.25 }}>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Deal meta */}
      <Box sx={{ mt: 0.75 }}>
        <KV label="Effective"  value={deal.effective_date} />
        <KV label="Address"    value={deal.hotel_address} />
        <KV label="Formation"  value={deal.state_of_formation} />
      </Box>

      {/* Flags */}
      {flags.length > 0 && (
        <>
          <SectionLabel>Review flags</SectionLabel>
          {flags.map((f, i) => <FlagRow key={i} text={f} />)}
        </>
      )}

      <Divider sx={{ my: 1 }} />

      {/* Entities */}
      <Section label={`ENTITY STRUCTURE (${entities.length})`}>
        {entities.map((e, i) => <EntityCard key={i} entity={e} />)}
      </Section>

      <Divider sx={{ my: 0.25 }} />

      {/* Loan */}
      {loan && (
        <>
          <Section label="LOAN">
            <Box sx={{
              border: '1px solid', borderColor: 'divider',
              borderLeft: '3px solid #185fa5', borderRadius: 1, p: 1,
            }}>
              <KV label="Lender" value={loan.lender} />
              <KV label="Amount" value={fmtCurrency(loan.amount)} />
              <KV label="Type"   value={loan.type} />
              {loan.notes && (
                <Typography variant="caption" color="text.disabled" display="block"
                  sx={{ mt: 0.5, fontStyle: 'italic' }}>
                  {loan.notes}
                </Typography>
              )}
            </Box>
          </Section>
          <Divider sx={{ my: 0.25 }} />
        </>
      )}

      {/* Fees */}
      {fees.length > 0 && (
        <>
          <Section label={`FEES (${fees.length})`}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableBody>
                {fees.map((f, i) => <FeeRow key={i} fee={f} />)}
              </TableBody>
            </Table>
          </Section>
          <Divider sx={{ my: 0.25 }} />
        </>
      )}

      {/* Waterfall */}
      {waterfall.length > 0 && (
        <>
          <Section label="DISTRIBUTION WATERFALL">
            {waterfall.map((tier, i) => <WaterfallTier key={i} tier={tier} index={i} />)}
          </Section>
          <Divider sx={{ my: 0.25 }} />
        </>
      )}

      {/* Key persons */}
      {key_persons.length > 0 && (
        <Section label="KEY PERSONS" defaultExpanded={false}>
          {key_persons.map((p, i) => <KeyPersonRow key={i} person={p} />)}
        </Section>
      )}
    </Box>
  )
}
