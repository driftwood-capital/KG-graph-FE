import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Box, Typography, Divider, Chip, Stack,
  CircularProgress, IconButton, Skeleton, TextField,
  InputAdornment,
} from '@mui/material'
import { CloseIcon, SearchIcon, AttachFileIcon } from '../icons'
import dayjs from 'dayjs'
import { fetchTimeline, fetchEmailDetail, fetchEmailSummary } from '../api'
import type { TimelineEvent, EmailDetail, GraphNode } from '../types'

const INTENT_STYLES: Record<string, { bg: string; color: string }> = {
  LEGAL:          { bg: '#99355622', color: '#993556' },
  DUE_DILIGENCE:  { bg: '#BA751722', color: '#BA7517' },
  CLOSING:        { bg: '#1D9E7522', color: '#1D9E75' },
  FINANCING:      { bg: '#185FA522', color: '#85B7EB' },
  OPS:            { bg: '#88878022', color: '#888780' },
  UNKNOWN:        { bg: '#44444122', color: '#888780' },
}

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#1D9E75',
  NEUTRAL:  '#888780',
  NEGATIVE: '#D85A30',
  URGENT:   '#E24B4A',
}

interface Props {
  focusedNode:  GraphNode | null
  onEmailClick: (emailId: string) => void
}

export default function TimelinePanel({ focusedNode, onEmailClick }: Props) {
  const [events, setEvents]               = useState<TimelineEvent[]>([])
  const [filtered, setFiltered]           = useState<TimelineEvent[]>([])
  const [loading, setLoading]             = useState(false)
  const [selected, setSelected]           = useState<EmailDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [summary, setSummary]             = useState<string | null>(null)
  const [actionItems, setActionItems]     = useState<string[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [entityFilter, setEntityFilter]   = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchTimeline({ entity_id: focusedNode?.id ?? undefined, limit: 50 })
      .then(data => { setEvents(data); setFiltered(data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [focusedNode?.id])

  useEffect(() => { load() }, [load])

  // Filter by entity search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!entityFilter.trim()) {
        setFiltered(events)
        return
      }
      const q = entityFilter.toLowerCase()
      setFiltered(events.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.from_name?.toLowerCase().includes(q) ||
        e.entities.some(en => en.toLowerCase().includes(q))
      ))
    }, 200)
  }, [entityFilter, events])

  const handleEventClick = (emailId: string) => {
    setLoadingDetail(true)
    setSummary(null)
    setActionItems([])
    onEmailClick(emailId)
    Promise.all([
      fetchEmailDetail(emailId),
      (async () => {
        setLoadingSummary(true)
        try {
          const s = await fetchEmailSummary(emailId)
          setSummary(s.summary)
          setActionItems(s.action_items)
        } catch { /* non-critical */ }
        finally { setLoadingSummary(false) }
      })(),
    ])
      .then(([detail]) => setSelected(detail))
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }

  const handleClose = () => {
    setSelected(null)
    setSummary(null)
    setActionItems([])
  }

  return (
    <Box sx={{
      width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
    }}>

      {/* Header */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: focusedNode ? 0.25 : 0 }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
            Timeline
          </Typography>
          {loading && <CircularProgress size={11} sx={{ color: 'primary.main' }} />}
        </Box>
        {focusedNode && (
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, fontSize: '0.78rem' }}>
            {focusedNode.name}
          </Typography>
        )}
      </Box>

      {/* Entity filter search */}
      {!selected && (
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Filter by entity or subject…"
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: entityFilter ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setEntityFilter('')} sx={{ p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiInputBase-root': {
                fontSize: '0.75rem',
                bgcolor: 'rgba(255,255,255,0.03)',
                py: 0,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.1)',
              },
            }}
          />
          {entityFilter && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      )}

      {selected ? (
        /* Email detail */
        <Box sx={{ overflowY: 'auto', flex: 1, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', flex: 1, pr: 1, lineHeight: 1.4 }}>
              {selected.subject}
            </Typography>
            <IconButton size="small" onClick={handleClose} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>

          {selected.sent_at && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
              {dayjs(selected.sent_at).format('MMM D, YYYY h:mm A')}
            </Typography>
          )}

          {/* Summary */}
          <Box sx={{
            mb: 1.75, p: 1.25,
            bgcolor: 'rgba(127,119,221,0.06)',
            border: '1px solid rgba(127,119,221,0.18)',
            borderLeft: '3px solid rgba(127,119,221,0.55)',
            borderRadius: '0 6px 6px 0',
            minHeight: 48,
          }}>
            <Typography variant="caption" sx={{ color: 'rgba(175,169,236,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
              ✦ Summary
            </Typography>
            {loadingSummary ? (
              <Stack gap={0.5}>
                <Skeleton variant="text" sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }} />
                <Skeleton variant="text" width="85%" sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }} />
                <Skeleton variant="text" width="70%" sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }} />
              </Stack>
            ) : summary ? (
              <Typography variant="caption" sx={{ color: 'rgba(232,230,224,0.85)', lineHeight: 1.65, display: 'block' }}>
                {summary}
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>No summary available</Typography>
            )}
          </Box>

          {/* Action items */}
          {(loadingSummary || actionItems.length > 0) && (
            <Box sx={{ mb: 1.75 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Action items{actionItems.length > 0 ? ` (${actionItems.length})` : ''}
              </Typography>
              {loadingSummary && actionItems.length === 0 ? (
                <Stack gap={0.5}>
                  <Skeleton variant="rounded" height={32} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton variant="rounded" height={32} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                </Stack>
              ) : actionItems.map((item, i) => (
                <Box key={i} sx={{
                  display: 'flex', gap: 1, mb: 0.6, p: 0.85,
                  bgcolor: 'rgba(29,158,117,0.05)',
                  border: '1px solid rgba(29,158,117,0.12)',
                  borderRadius: 1, alignItems: 'flex-start',
                }}>
                  <Typography variant="caption" sx={{ color: 'secondary.main', flexShrink: 0, fontWeight: 600, minWidth: 16, lineHeight: 1.5 }}>
                    {i + 1}.
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.primary', lineHeight: 1.5 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ my: 1.25 }} />

          {/* Participants */}
          {selected.participants.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Participants
              </Typography>
              {selected.participants.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.25 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 28 }}>
                    {p.ROLE.toLowerCase()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.primary' }}>
                    {p.RAW_NAME || p.RAW_EMAIL}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ my: 1.25 }} />

          {/* Entities */}
          {selected.entities.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Entities
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {selected.entities.map((e, i) => (
                  <Chip key={i} label={e.CANONICAL_NAME} size="small" sx={{
                    fontSize: '0.68rem', height: 20,
                    bgcolor: e.ENTITY_TYPE === 'PERSON' ? 'rgba(127,119,221,0.12)'
                           : e.ENTITY_TYPE === 'ORGANIZATION' ? 'rgba(29,158,117,0.12)'
                           : 'rgba(136,135,128,0.12)',
                    color:   e.ENTITY_TYPE === 'PERSON' ? '#AFA9EC'
                           : e.ENTITY_TYPE === 'ORGANIZATION' ? '#5DCAA5'
                           : '#B4B2A9',
                    border: 'none',
                  }} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Attachments with Box links */}
          {selected.attachments.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Attachments
              </Typography>
              {selected.attachments.map(a => (
                <Box key={a.ATTACHMENT_ID} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                  <AttachFileIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
                  {a.BOX_URL ? (
                    <Typography variant="caption" component="a" href={a.BOX_URL} target="_blank" rel="noopener"
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {a.FILENAME}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{a.FILENAME}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ) : (
        /* Event list */
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {loadingDetail && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={20} />
            </Box>
          )}
          {filtered.map(evt => {
            const intentStyle = INTENT_STYLES[evt.intent ?? 'UNKNOWN'] ?? INTENT_STYLES.UNKNOWN
            const sentColor   = SENTIMENT_COLORS[evt.sentiment ?? 'NEUTRAL'] ?? '#888780'
            return (
              <Box
                key={evt.email_id}
                onClick={() => handleEventClick(evt.email_id)}
                sx={{
                  px: 2, py: 1.25, cursor: 'pointer',
                  borderBottom: '1px solid', borderColor: 'divider',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                {evt.sent_at && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    {dayjs(evt.sent_at).format('MMM D, YYYY')}
                  </Typography>
                )}
                <Typography variant="body2" sx={{
                  color: 'text.primary', fontWeight: 500, fontSize: '0.78rem',
                  lineHeight: 1.35, mb: 0.5,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {evt.subject}
                </Typography>
                {evt.from_name && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    {evt.from_name}
                  </Typography>
                )}
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {evt.intent && evt.intent !== 'UNKNOWN' && (
                    <Chip label={evt.intent.replace('_', ' ')} size="small" sx={{
                      bgcolor: intentStyle.bg, color: intentStyle.color,
                      border: `1px solid ${intentStyle.color}44`,
                      fontSize: '0.63rem', height: 18,
                    }} />
                  )}
                  {evt.sentiment && evt.sentiment !== 'NEUTRAL' && (
                    <Chip label={evt.sentiment} size="small" sx={{
                      bgcolor: `${sentColor}22`, color: sentColor,
                      fontSize: '0.63rem', height: 18, border: 'none',
                    }} />
                  )}
                  {evt.entities.slice(0, 2).map((e, i) => (
                    <Chip key={i} label={e} size="small" sx={{
                      bgcolor: 'rgba(255,255,255,0.04)', color: 'text.secondary',
                      fontSize: '0.63rem', height: 18, border: 'none',
                    }} />
                  ))}
                </Stack>
              </Box>
            )
          })}
          {filtered.length === 0 && !loading && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {entityFilter ? `No results for "${entityFilter}"` : 'No emails found'}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
