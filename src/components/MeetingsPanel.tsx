import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Chip, Stack, Divider,
  CircularProgress, IconButton, Paper,
} from '@mui/material'
import { CloseIcon } from '../icons'
import dayjs from 'dayjs'
import { fetchMeetings, fetchMeetingDetail } from '../api'
import type { GraphNode } from '../types'

const PLATFORM_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  teams:       { bg: 'rgba(43,143,212,0.12)',  color: '#2B8FD4', label: 'Teams'      },
  google_meet: { bg: 'rgba(29,158,117,0.12)',  color: '#5DCAA5', label: 'Meet'       },
  zoom:        { bg: 'rgba(43,143,212,0.12)',  color: '#85B7EB', label: 'Zoom'       },
  unknown:     { bg: 'rgba(136,135,128,0.1)',  color: '#888780', label: 'Unknown'    },
}

function fmt(secs: number | null): string {
  if (!secs) return ''
  const m = Math.round(secs / 60)
  return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`
}

interface Props {
  focusedNode: GraphNode | null
}

export default function MeetingsPanel({ focusedNode }: Props) {
  const [meetings, setMeetings]       = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [selected, setSelected]       = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchMeetings({ limit: 50 })
      .then(setMeetings)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleClick = (meeting: any) => {
    setLoadingDetail(true)
    fetchMeetingDetail(meeting.MEETING_ID)
      .then(setSelected)
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }

  return (
    <Box sx={{
      width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
    }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
            Meetings
          </Typography>
          {loading && <CircularProgress size={11} sx={{ color: '#2B8FD4' }} />}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {meetings.length} ingested
        </Typography>
      </Box>

      {selected ? (
        /* Meeting detail */
        <Box sx={{ overflowY: 'auto', flex: 1, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', flex: 1, pr: 1, lineHeight: 1.4 }}>
              {selected.MEETING_TITLE}
            </Typography>
            <IconButton size="small" onClick={() => setSelected(null)} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>

          {/* Meta row */}
          <Stack direction="row" gap={0.75} mb={1.25} flexWrap="wrap">
            {selected.PLATFORM && (
              <Chip
                label={(PLATFORM_STYLES[selected.PLATFORM] ?? PLATFORM_STYLES.unknown).label}
                size="small"
                sx={{
                  fontSize: '0.63rem', height: 18,
                  bgcolor: (PLATFORM_STYLES[selected.PLATFORM] ?? PLATFORM_STYLES.unknown).bg,
                  color:   (PLATFORM_STYLES[selected.PLATFORM] ?? PLATFORM_STYLES.unknown).color,
                }}
              />
            )}
            {selected.STARTED_AT && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {dayjs(selected.STARTED_AT).format('MMM D, YYYY h:mm A')}
              </Typography>
            )}
            {selected.DURATION_SECONDS && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                · {fmt(selected.DURATION_SECONDS)}
              </Typography>
            )}
            {selected.SPEAKER_COUNT && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                · {selected.SPEAKER_COUNT} speakers
              </Typography>
            )}
          </Stack>

          {/* Summary */}
          {selected.SUMMARY && (
            <Box sx={{
              mb: 1.75, p: 1.25,
              bgcolor: 'rgba(43,143,212,0.06)',
              border: '1px solid rgba(43,143,212,0.18)',
              borderLeft: '3px solid rgba(43,143,212,0.55)',
              borderRadius: '0 6px 6px 0',
            }}>
              <Typography variant="caption" sx={{ color: 'rgba(133,183,235,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
                ✦ Summary
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(232,230,224,0.85)', lineHeight: 1.65, display: 'block' }}>
                {selected.SUMMARY}
              </Typography>
            </Box>
          )}

          {/* Action items */}
          {(() => {
            let items: string[] = []
            try { items = JSON.parse(selected.ACTION_ITEMS || '[]') } catch {}
            return items.length > 0 ? (
              <Box sx={{ mb: 1.75 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Action items ({items.length})
                </Typography>
                {items.map((item: string, i: number) => (
                  <Box key={i} sx={{
                    display: 'flex', gap: 1, mb: 0.6, p: 0.85,
                    bgcolor: 'rgba(29,158,117,0.05)',
                    border: '1px solid rgba(29,158,117,0.12)',
                    borderRadius: 1, alignItems: 'flex-start',
                  }}>
                    <Typography variant="caption" sx={{ color: 'secondary.main', flexShrink: 0, fontWeight: 600, minWidth: 16 }}>
                      {i + 1}.
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.primary', lineHeight: 1.5 }}>{item}</Typography>
                  </Box>
                ))}
              </Box>
            ) : null
          })()}

          {/* Key topics */}
          {selected.KEY_TOPICS && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Key Topics
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5, display: 'block' }}>
                {selected.KEY_TOPICS}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 1.25 }} />

          {/* Participants */}
          {selected.participants?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Participants ({selected.participants.length})
              </Typography>
              {selected.participants.map((p: any, i: number) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.3, alignItems: 'center' }}>
                  <Chip
                    label={p.ROLE}
                    size="small"
                    sx={{
                      fontSize: '0.58rem', height: 14, flexShrink: 0,
                      bgcolor: p.ROLE === 'ORGANIZER' ? 'rgba(43,143,212,0.15)' : 'rgba(255,255,255,0.05)',
                      color:   p.ROLE === 'ORGANIZER' ? '#85B7EB' : 'text.secondary',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: p.ROLE === 'ORGANIZER' ? 'text.primary' : 'text.secondary' }}>
                    {p.RAW_NAME || p.RAW_EMAIL}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Entities */}
          {selected.entities?.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Entities
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {selected.entities.map((e: any, i: number) => (
                  <Chip key={i} label={e.CANONICAL_NAME} size="small" sx={{
                    fontSize: '0.68rem', height: 20,
                    bgcolor: e.ENTITY_TYPE === 'PERSON' ? 'rgba(127,119,221,0.12)' : 'rgba(29,158,117,0.12)',
                    color:   e.ENTITY_TYPE === 'PERSON' ? '#AFA9EC' : '#5DCAA5',
                    border: 'none',
                  }} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Deal link */}
          {selected.DEAL_ID && (
            <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Deal: <span style={{ color: '#AFA9EC' }}>{selected.DEAL_ID}</span>
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        /* Meeting list */
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {loadingDetail && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={20} />
            </Box>
          )}
          {meetings.map(m => {
            const ps = PLATFORM_STYLES[m.PLATFORM] ?? PLATFORM_STYLES.unknown
            return (
              <Box
                key={m.MEETING_ID}
                onClick={() => handleClick(m)}
                sx={{
                  px: 2, py: 1.25, cursor: 'pointer',
                  borderBottom: '1px solid', borderColor: 'divider',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                {m.STARTED_AT && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    {dayjs(m.STARTED_AT).format('MMM D, YYYY')}
                    {m.DURATION_SECONDS ? ` · ${fmt(m.DURATION_SECONDS)}` : ''}
                  </Typography>
                )}
                <Typography variant="body2" sx={{
                  color: 'text.primary', fontWeight: 500, fontSize: '0.78rem',
                  lineHeight: 1.35, mb: 0.5,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {m.MEETING_TITLE}
                </Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  <Chip label={ps.label} size="small" sx={{
                    fontSize: '0.63rem', height: 18,
                    bgcolor: ps.bg, color: ps.color,
                  }} />
                  {m.ORGANIZER_NAME && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: '18px' }}>
                      {m.ORGANIZER_NAME}
                    </Typography>
                  )}
                  {m.DEAL_ID && (
                    <Chip label="Deal linked" size="small" sx={{
                      fontSize: '0.63rem', height: 18,
                      bgcolor: 'rgba(127,119,221,0.1)', color: '#AFA9EC',
                    }} />
                  )}
                </Stack>
              </Box>
            )
          })}
          {meetings.length === 0 && !loading && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                No meetings ingested yet
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                Run: python meeting_connector.py
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
