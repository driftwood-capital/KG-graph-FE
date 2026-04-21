import { useState, useRef } from 'react'
import {
  Box, Typography, TextField, InputAdornment,
  CircularProgress, Paper, Chip, Stack, Divider,
} from '@mui/material'
import { SearchIcon } from '../icons'
import { search } from '../api'
import type { SearchResult } from '../types'
import dayjs from 'dayjs'

export default function SearchPanel() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); setSearched(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setSearched(true)
      try {
        const r = await search(q, 10)
        setResults(r)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }, 500)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header + search box */}
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '0.9rem', mb: 1.25 }}>
          Semantic search
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search emails and documents…"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {loading
                  ? <CircularProgress size={14} sx={{ color: 'text.secondary' }} />
                  : <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                }
              </InputAdornment>
            ),
          }}
          sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem', bgcolor: 'rgba(255,255,255,0.04)' } }}
        />
        {searched && !loading && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.75, display: 'block' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </Typography>
        )}
      </Box>

      {/* Results */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1.5 }}>
        {!searched ? (
          <Box sx={{ textAlign: 'center', pt: 6 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Search across email bodies, attachments, and documents
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Try: "Melbourne lien search" or "LLC amendment Delaware counsel"
            </Typography>
          </Box>
        ) : results.length === 0 && !loading ? (
          <Box sx={{ textAlign: 'center', pt: 6 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>No results found</Typography>
          </Box>
        ) : (
          results.map((r, i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                p: 1.5, mb: 1,
                border: '1px solid rgba(255,255,255,0.06)',
                bgcolor: 'rgba(255,255,255,0.02)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
              }}
            >
              {/* Score + source type */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Chip
                  label={r.source_type}
                  size="small"
                  sx={{
                    fontSize: '0.62rem', height: 18,
                    bgcolor: r.source_type === 'email' ? 'rgba(186,117,23,0.15)' : 'rgba(127,119,221,0.15)',
                    color:   r.source_type === 'email' ? '#EF9F27' : '#AFA9EC',
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {(r.score * 100).toFixed(0)}% match
                </Typography>
              </Box>

              {/* Subject or filename */}
              {r.subject && (
                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', fontSize: '0.78rem', lineHeight: 1.35, mb: 0.5 }}>
                  {r.subject}
                </Typography>
              )}
              {r.filename && (
                <Typography variant="body2" sx={{ color: 'primary.main', fontSize: '0.75rem', mb: 0.5 }}>
                  {r.filename}
                </Typography>
              )}

              {/* Preview */}
              {r.body_preview && (
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5, display: 'block', mb: 0.5 }}>
                  {r.body_preview.length > 150 ? r.body_preview.slice(0, 148) + '…' : r.body_preview}
                </Typography>
              )}

              {/* Timestamp + chunk */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {r.timestamp && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {dayjs(r.timestamp).format('MMM D, YYYY')}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  chunk {r.chunk_index + 1}
                </Typography>
              </Box>
            </Paper>
          ))
        )}
      </Box>
    </Box>
  )
}
