import { useEffect, useState } from 'react'
import {
  Box, Typography, Button, Chip, Stack,
  CircularProgress, LinearProgress, Paper, Divider,
} from '@mui/material'
import axios from 'axios'
import dayjs from 'dayjs'
import { triggerIngest, fetchIngestStatus, fetchStats } from '../api'
import type { Stats } from '../types'

interface IngestStatus { pending: number; processing: number; complete: number; failed: number; total: number }

export default function IngestPanel() {
  const [status, setStatus]     = useState<IngestStatus | null>(null)
  const [stats, setStats]       = useState<Stats | null>(null)
  const [running, setRunning]   = useState(false)
  const [message, setMessage]   = useState<string | null>(null)
  const [polling, setPolling]   = useState(false)

  const refresh = () => {
    fetchIngestStatus().then(setStatus).catch(console.error)
    fetchStats().then(setStats).catch(console.error)
  }

  useEffect(() => { refresh() }, [])

  // Poll while processing
  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => {
      fetchIngestStatus().then(s => {
        setStatus(s)
        if (s.processing === 0 && s.pending === 0) {
          setPolling(false)
          setRunning(false)
          fetchStats().then(setStats)
          setMessage('Ingest complete')
        }
      })
    }, 3000)
    return () => clearInterval(id)
  }, [polling])

  const handleRun = async () => {
    setRunning(true)
    setMessage(null)
    try {
      const r = await triggerIngest()
      if (r.status === 'already_running') {
        setMessage('Already running — check status below')
        setRunning(false)
      } else {
        setMessage(`Job ${r.job_id} started`)
        setPolling(true)
      }
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
      setRunning(false)
    }
  }

  const pct = status && status.total > 0
    ? Math.round((status.complete / status.total) * 100)
    : 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>Ingest</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Pull new emails, extract entities, embed to Pinecone
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>

        {/* Trigger */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', display: 'block', mb: 1.25 }}>
            Run ingest
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={handleRun}
            disabled={running}
            startIcon={running ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', fontSize: '0.8rem', mb: 1 }}
          >
            {running ? 'Running…' : 'Pull & process new emails'}
          </Button>
          {message && (
            <Typography variant="caption" sx={{ color: running ? 'text.secondary' : 'secondary.main', display: 'block' }}>
              {message}
            </Typography>
          )}
        </Paper>

        {/* Status */}
        {status && (
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', display: 'block', mb: 1.25 }}>
              Extraction status
            </Typography>
            {status.total > 0 && (
              <Box sx={{ mb: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Progress</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{pct}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: 'secondary.main' } }}
                />
              </Box>
            )}
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Chip label={`${status.complete} complete`}   size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: 'rgba(29,158,117,0.12)',  color: '#5DCAA5' }} />
              <Chip label={`${status.pending} pending`}     size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: 'rgba(136,135,128,0.1)',  color: '#888780' }} />
              {status.processing > 0 && <Chip label={`${status.processing} processing`} size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: 'rgba(186,117,23,0.12)', color: '#EF9F27' }} />}
              {status.failed > 0     && <Chip label={`${status.failed} failed`}         size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: 'rgba(226,75,74,0.12)',  color: '#E24B4A' }} />}
            </Stack>
          </Paper>
        )}

        {/* Stats */}
        {stats && (
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', display: 'block', mb: 1.25 }}>
              Knowledge graph stats
            </Typography>
            <Stack gap={0.5}>
              {[
                { label: 'Emails',        value: stats.emails },
                { label: 'Persons',       value: stats.persons },
                { label: 'Organizations', value: stats.organizations },
                { label: 'Relationships', value: stats.relationships },
                { label: 'Obligations',   value: stats.obligations },
                { label: 'Vectors',       value: stats.vectors },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>{value.toLocaleString()}</Typography>
                </Box>
              ))}
            </Stack>
            {stats.last_ingested && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                Last ingested: {dayjs(stats.last_ingested).format('MMM D, YYYY h:mm A')}
              </Typography>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  )
}
