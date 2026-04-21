// DealsTab.tsx
// Deal management tab — browse, search, filter, and inline-edit deals.
// Integrates with PATCH /api/deals/{deal_id} for field updates.
// Writes audit log on every change.

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Box, Typography, TextField, InputAdornment, Chip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, CircularProgress, Select, MenuItem,
  FormControl, Collapse, Divider, Button, Switch, FormControlLabel,
  Snackbar, Alert,
} from "@mui/material"
import SearchIcon          from "@mui/icons-material/Search"
import EditIcon            from "@mui/icons-material/Edit"
import SaveIcon            from "@mui/icons-material/Save"
import CancelIcon          from "@mui/icons-material/Cancel"
import OpenInNewIcon       from "@mui/icons-material/OpenInNew"
import WarningAmberIcon    from "@mui/icons-material/WarningAmber"
import FilterListIcon      from "@mui/icons-material/FilterList"
import ExpandMoreIcon      from "@mui/icons-material/ExpandMore"
import ExpandLessIcon      from "@mui/icons-material/ExpandLess"
import CheckCircleIcon     from "@mui/icons-material/CheckCircle"
import ErrorOutlineIcon    from "@mui/icons-material/ErrorOutline"

const API = "http://localhost:8000"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Deal {
  deal_id:             string
  name:                string
  deal_type:           string
  status:              string
  pipeline_status:     string | null
  deal_stage:          string | null
  location_city:       string | null
  location_state:      string | null
  close_date:          string | null
  exit_date:           string | null
  exit_type:           string | null
  default_event:       boolean | null
  hold_period_months:  number | null
  ic_projected_irr_pct: number | null
  ic_projected_em:     number | null
  actual_irr_pct:      number | null
  actual_em:           number | null
  brand:               string | null
  keys_rooms:          number | null
  property_type:       string | null
  property_name:       string | null
  chain_scale:         string | null
  franchisor:          string | null
  dlp_amount:          number | null
  dlp_spread_bps:      number | null
  dlp_floor_pct:       number | null
  dlp_maturity:        string | null
  as_is_ltv_pct:       number | null
  as_is_debt_yield_pct: number | null
  as_is_noi:           number | null
  dscr:                number | null
  index_last_updated:  string | null
  last_edited_by:      string | null
  last_edited_at:      string | null
  asset_count:         number
  fund_code:           string
  irr:                 number | null
  em:                  number | null
}

interface EditState {
  [field: string]: string | number | boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtM = (v: number | null | undefined) =>
  v == null ? "—" : v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`

const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : v < 1 ? `${(v*100).toFixed(1)}%` : `${v.toFixed(1)}%`

const fmtBps = (v: number | null | undefined) =>
  v == null ? "—" : `+${v}bps`

const fmtDate = (s: string | null | undefined) =>
  !s ? "—" : new Date(s).toLocaleDateString("en-US", { month:"short", year:"numeric" })

const STAGE_COLORS: Record<string, string> = {
  Realized:  "#4CAF50",
  Portfolio: "#2196F3",
  Pipeline:  "#FF9800",
  Passed:    "#9E9E9E",
  Dead:      "#F44336",
}

const STATUS_COLORS: Record<string, string> = {
  "Under Review":  "#FF9800",
  "Term Sheet":    "#2196F3",
  "IC Approved":   "#9C27B0",
  "Closed":        "#4CAF50",
  "Passed":        "#9E9E9E",
  "Dead Deal":     "#F44336",
  "Old Deal":      "#607D8B",
  "Active":        "#4CAF50",
}

// ─── Editable cell ───────────────────────────────────────────────────────────

function EditCell({
  value, field, type = "text", editing, onChange,
}: {
  value: string | number | null
  field: string
  type?: "text" | "number" | "date"
  editing: boolean
  onChange: (field: string, val: string | number) => void
}) {
  if (!editing) {
    return (
      <Typography sx={{ fontSize: "0.75rem", color: value == null ? "text.disabled" : "text.primary" }}>
        {value == null ? "—" : String(value)}
      </Typography>
    )
  }
  return (
    <TextField
      size="small"
      type={type}
      defaultValue={value ?? ""}
      onChange={e => onChange(field, type === "number" ? Number(e.target.value) : e.target.value)}
      sx={{
        width: type === "date" ? 130 : type === "number" ? 90 : 160,
        "& .MuiInputBase-input": { fontSize: "0.72rem", py: 0.4, px: 0.75 },
        "& .MuiOutlinedInput-root": {
          "& fieldset": { borderColor: "rgba(255,122,0,0.4)" },
          "&:hover fieldset": { borderColor: "rgba(255,122,0,0.7)" },
          "&.Mui-focused fieldset": { borderColor: "#FF7A00" },
        },
      }}
    />
  )
}

// ─── Deal row ────────────────────────────────────────────────────────────────

function DealRow({
  deal, expanded, onExpand, currentUser,
}: {
  deal: Deal
  expanded: boolean
  onExpand: () => void
  currentUser: string
}) {
  const [editing, setEditing]   = useState(false)
  const [edits, setEdits]       = useState<EditState>({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string|null>(null)

  const handleEdit = (field: string, val: string | number) => {
    setEdits(prev => ({ ...prev, [field]: val }))
  }

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const resp = await fetch(`${API}/api/deals/${deal.deal_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...edits, changed_by: currentUser, change_source: "UI" }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setEditing(false)
      setEdits({})
    } catch (e: any) {
      setError(e.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const stage     = deal.deal_stage || deal.status || "—"
  const stageColor = STAGE_COLORS[stage] || "#888"
  const psColor   = STATUS_COLORS[deal.pipeline_status || ""] || "#888"

  return (
    <>
      <TableRow
        onClick={onExpand}
        sx={{
          cursor: "pointer",
          bgcolor: expanded ? "rgba(255,255,255,0.03)" : "transparent",
          "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
          borderLeft: deal.default_event ? "3px solid #F44336" : "3px solid transparent",
          transition: "background 0.1s",
        }}
      >
        {/* Expand */}
        <TableCell sx={{ p: 0.5, width: 28 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                    : <ExpandMoreIcon  sx={{ fontSize: 14, color: "text.secondary" }} />}
        </TableCell>

        {/* Name + location */}
        <TableCell sx={{ py: 0.75, pl: 0.5, minWidth: 200 }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.primary", lineHeight: 1.2 }}>
            {deal.brand || deal.name}
          </Typography>
          {(deal.location_city || deal.location_state) && (
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
              {[deal.location_city, deal.location_state].filter(Boolean).join(", ")}
            </Typography>
          )}
        </TableCell>

        {/* Stage */}
        <TableCell sx={{ py: 0.75 }}>
          <Chip label={stage} size="small" sx={{
            height: 17, fontSize: "0.6rem", fontWeight: 600,
            bgcolor: `${stageColor}22`, color: stageColor,
            border: `1px solid ${stageColor}44`,
          }} />
        </TableCell>

        {/* Pipeline status */}
        <TableCell sx={{ py: 0.75 }}>
          {deal.pipeline_status && (
            <Chip label={deal.pipeline_status} size="small" sx={{
              height: 17, fontSize: "0.6rem",
              bgcolor: `${psColor}15`, color: psColor,
            }} />
          )}
        </TableCell>

        {/* Keys */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.primary" }}>
            {deal.keys_rooms ?? "—"}
          </Typography>
        </TableCell>

        {/* DLP Amount */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "#5DCAA5", fontWeight: 500 }}>
            {fmtM(deal.dlp_amount)}
          </Typography>
        </TableCell>

        {/* Spread */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {fmtBps(deal.dlp_spread_bps)}
          </Typography>
        </TableCell>

        {/* Maturity */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.primary" }}>
            {fmtDate(deal.dlp_maturity)}
          </Typography>
        </TableCell>

        {/* LTV */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {fmtPct(deal.as_is_ltv_pct)}
          </Typography>
        </TableCell>

        {/* DY */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {fmtPct(deal.as_is_debt_yield_pct)}
          </Typography>
        </TableCell>

        {/* IRR */}
        <TableCell sx={{ py: 0.75, textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.75rem", color: deal.actual_irr_pct ? "#4CAF50" : "text.secondary" }}>
            {fmtPct(deal.actual_irr_pct || deal.ic_projected_irr_pct)}
            {deal.actual_irr_pct && <span style={{ fontSize: "0.6rem", opacity: 0.7 }}> act</span>}
          </Typography>
        </TableCell>

        {/* Default flag */}
        <TableCell sx={{ py: 0.75, textAlign: "center", width: 36 }}>
          {deal.default_event && (
            <Tooltip title="Maturity default">
              <WarningAmberIcon sx={{ fontSize: 14, color: "#F44336" }} />
            </Tooltip>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell sx={{ py: 0.75, width: 80 }} onClick={e => e.stopPropagation()}>
          <Stack direction="row" spacing={0.5}>
            {editing ? (
              <>
                <Tooltip title="Save changes">
                  <IconButton size="small" onClick={handleSave} disabled={saving}
                    sx={{ color: "#4CAF50", p: 0.25 }}>
                    {saving ? <CircularProgress size={12} /> : <SaveIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton size="small" onClick={() => { setEditing(false); setEdits({}) }}
                    sx={{ color: "text.secondary", p: 0.25 }}>
                    <CancelIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title="Edit deal">
                  <IconButton size="small" onClick={() => setEditing(true)}
                    sx={{ color: "text.secondary", p: 0.25, "&:hover": { color: "#FF7A00" } }}>
                    <EditIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open in graph">
                  <IconButton size="small"
                    onClick={() => window.open(`http://localhost:5173/?focus=${deal.deal_id}`, "_blank")}
                    sx={{ color: "text.secondary", p: 0.25, "&:hover": { color: "#7F77DD" } }}>
                    <OpenInNewIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {saved && <CheckCircleIcon sx={{ fontSize: 14, color: "#4CAF50", alignSelf: "center" }} />}
          </Stack>
        </TableCell>
      </TableRow>

      {/* Expanded edit panel */}
      <TableRow>
        <TableCell colSpan={14} sx={{ p: 0, border: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{
              bgcolor: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              px: 3, py: 2,
            }}>
              {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5, fontSize: "0.72rem" }}>
                  {error}
                </Alert>
              )}
              <Stack direction="row" spacing={4} flexWrap="wrap" gap={2}>
                {/* Pipeline */}
                <Box>
                  <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                    Pipeline
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Status</Typography>
                      <EditCell value={deal.pipeline_status} field="pipeline_status" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Stage</Typography>
                      <EditCell value={deal.deal_stage} field="deal_stage" editing={editing} onChange={handleEdit} />
                    </Box>
                  </Stack>
                </Box>

                {/* DLP Position */}
                <Box>
                  <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                    DLP Position
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Amount</Typography>
                      <EditCell value={deal.dlp_amount} field="dlp_amount" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Spread (bps)</Typography>
                      <EditCell value={deal.dlp_spread_bps} field="dlp_spread_bps" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Maturity</Typography>
                      <EditCell value={deal.dlp_maturity?.slice(0,10) ?? null} field="dlp_maturity" type="date" editing={editing} onChange={handleEdit} />
                    </Box>
                  </Stack>
                </Box>

                {/* Underwriting */}
                <Box>
                  <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                    Underwriting
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>As-Is LTV %</Typography>
                      <EditCell value={deal.as_is_ltv_pct} field="as_is_ltv_pct" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Debt Yield %</Typography>
                      <EditCell value={deal.as_is_debt_yield_pct} field="as_is_debt_yield_pct" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>NOI</Typography>
                      <EditCell value={deal.as_is_noi} field="as_is_noi" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                  </Stack>
                </Box>

                {/* Returns */}
                <Box>
                  <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                    Returns
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>IC IRR %</Typography>
                      <EditCell value={deal.ic_projected_irr_pct} field="ic_projected_irr_pct" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Actual IRR %</Typography>
                      <EditCell value={deal.actual_irr_pct} field="actual_irr_pct" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.62rem", color: "text.disabled", mb: 0.25 }}>Actual EM</Typography>
                      <EditCell value={deal.actual_em} field="actual_em" type="number" editing={editing} onChange={handleEdit} />
                    </Box>
                  </Stack>
                </Box>

                {/* Notes */}
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                    Notes
                  </Typography>
                  {editing ? (
                    <TextField
                      multiline rows={4} size="small" fullWidth
                      defaultValue={""}
                      onChange={e => handleEdit("pipeline_notes", e.target.value)}
                      placeholder="Add pipeline notes..."
                      sx={{
                        "& .MuiInputBase-input": { fontSize: "0.72rem" },
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": { borderColor: "rgba(255,122,0,0.4)" },
                        },
                      }}
                    />
                  ) : (
                    <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontStyle: "italic" }}>
                      Click edit to add notes
                    </Typography>
                  )}
                  {deal.last_edited_by && (
                    <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", mt: 0.5 }}>
                      Last edited by {deal.last_edited_by}
                      {deal.last_edited_at && ` · ${new Date(deal.last_edited_at).toLocaleDateString()}`}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealsTab({ currentUser = "user@driftwoodcapital.com" }: { currentUser?: string }) {
  const [deals, setDeals]           = useState<Deal[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")
  const [stageFilter, setStageFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [stateFilter, setStateFilter] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [defaultsOnly, setDefaultsOnly] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set("search", search)
      if (stageFilter)  params.set("deal_stage", stageFilter)
      if (statusFilter) params.set("pipeline_status", statusFilter)
      if (stateFilter)  params.set("location_state", stateFilter)
      params.set("limit", "500")

      const res = await fetch(`${API}/api/deals?${params}`)
      const data: Deal[] = await res.json()
      setDeals(defaultsOnly ? data.filter(d => d.default_event) : data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, stageFilter, statusFilter, stateFilter, defaultsOnly])

  useEffect(() => {
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(fetchDeals, 300)
    return () => clearTimeout(searchRef.current)
  }, [fetchDeals])

  // Derive unique filter values
  const stages   = [...new Set(deals.map(d => d.deal_stage).filter(Boolean))].sort()
  const statuses = [...new Set(deals.map(d => d.pipeline_status).filter(Boolean))].sort()
  const states   = [...new Set(deals.map(d => d.location_state).filter(Boolean))].sort()

  const seeded  = deals.filter(d => d.index_last_updated).length
  const defaults = deals.filter(d => d.default_event).length

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header bar */}
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "text.primary", whiteSpace: "nowrap" }}>
            Deals
          </Typography>

          {/* Stats */}
          <Stack direction="row" spacing={1.5}>
            <Chip label={`${deals.length} total`} size="small"
              sx={{ height: 18, fontSize: "0.62rem", bgcolor: "rgba(255,255,255,0.06)" }} />
            {seeded > 0 && (
              <Chip label={`${seeded} indexed`} size="small"
                sx={{ height: 18, fontSize: "0.62rem", bgcolor: "rgba(93,202,165,0.12)", color: "#5DCAA5" }} />
            )}
            {defaults > 0 && (
              <Chip label={`${defaults} defaults`} size="small"
                sx={{ height: 18, fontSize: "0.62rem", bgcolor: "rgba(244,67,54,0.12)", color: "#F44336" }} />
            )}
          </Stack>

          <Box sx={{ flex: 1 }} />

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search deals, brands, cities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: "text.secondary" }} /></InputAdornment>,
            }}
            sx={{
              width: 260,
              "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.6 },
              "& .MuiOutlinedInput-root fieldset": { borderColor: "rgba(255,255,255,0.12)" },
            }}
          />

          {/* Defaults toggle */}
          <FormControlLabel
            control={<Switch size="small" checked={defaultsOnly} onChange={e => setDefaultsOnly(e.target.checked)}
              sx={{ "& .MuiSwitch-thumb": { width: 12, height: 12 }, "& .MuiSwitch-switchBase": { p: 1 } }} />}
            label={<Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>Defaults only</Typography>}
            sx={{ m: 0 }}
          />

          {/* Filters toggle */}
          <IconButton size="small" onClick={() => setShowFilters(f => !f)}
            sx={{ color: showFilters ? "#FF7A00" : "text.secondary" }}>
            <FilterListIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>

        {/* Filter row */}
        <Collapse in={showFilters}>
          <Stack direction="row" spacing={1.5} mt={1} flexWrap="wrap">
            {[
              { label: "Stage",  value: stageFilter,  set: setStageFilter,  opts: stages },
              { label: "Status", value: statusFilter, set: setStatusFilter, opts: statuses },
              { label: "State",  value: stateFilter,  set: setStateFilter,  opts: states },
            ].map(({ label, value, set, opts }) => (
              <FormControl key={label} size="small" sx={{ minWidth: 130 }}>
                <Select
                  value={value}
                  onChange={e => set(e.target.value)}
                  displayEmpty
                  renderValue={v => v || <span style={{ opacity: 0.5, fontSize: "0.72rem" }}>All {label}s</span>}
                  sx={{ fontSize: "0.72rem", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" } }}
                >
                  <MenuItem value="" sx={{ fontSize: "0.72rem" }}>All {label}s</MenuItem>
                  {opts.map(o => <MenuItem key={o} value={o!} sx={{ fontSize: "0.72rem" }}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            ))}
            <Button size="small" onClick={() => { setStageFilter(""); setStatusFilter(""); setStateFilter(""); }}
              sx={{ fontSize: "0.65rem", color: "text.secondary", textTransform: "none" }}>
              Clear
            </Button>
          </Stack>
        </Collapse>
      </Box>

      {/* Table */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : deals.length === 0 ? (
          <Box sx={{ textAlign: "center", pt: 6 }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.8rem" }}>No deals found</Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  { label: "",        w: 28  },
                  { label: "Deal",    w: 200 },
                  { label: "Stage",   w: 90  },
                  { label: "Status",  w: 110 },
                  { label: "Keys",    w: 55,  align: "right" as const },
                  { label: "DLP $",   w: 80,  align: "right" as const },
                  { label: "Spread",  w: 75,  align: "right" as const },
                  { label: "Maturity",w: 80,  align: "right" as const },
                  { label: "LTV",     w: 65,  align: "right" as const },
                  { label: "DY",      w: 60,  align: "right" as const },
                  { label: "IRR",     w: 65,  align: "right" as const },
                  { label: "⚠",       w: 36,  align: "center" as const },
                  { label: "",        w: 80  },
                ].map((col, i) => (
                  <TableCell key={i} align={col.align}
                    sx={{
                      width: col.w, fontSize: "0.62rem", fontWeight: 600,
                      color: "text.secondary", textTransform: "uppercase",
                      letterSpacing: 0.6, py: 0.75,
                      bgcolor: "background.paper",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      whiteSpace: "nowrap",
                    }}>
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {deals.map(deal => (
                <DealRow
                  key={deal.deal_id}
                  deal={deal}
                  expanded={expandedId === deal.deal_id}
                  onExpand={() => setExpandedId(expandedId === deal.deal_id ? null : deal.deal_id)}
                  currentUser={currentUser}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  )
}
