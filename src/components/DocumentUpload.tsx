import { useState, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, LinearProgress,
  Chip, Stack, CircularProgress,
} from '@mui/material'
import axios from 'axios'
import dayjs from 'dayjs'

interface UploadedDoc {
  document_id : string
  filename    : string
  status      : 'processing' | 'complete' | 'failed'
  uploaded_at : string
  entity_count?: number
  vector_count?: number
}

export default function DocumentUpload() {
  const [dragging,  setDragging]  = useState(false)
  const [uploads,   setUploads]   = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [docs,      setDocs]      = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(() => {
    setLoadingDocs(true)
    axios.get('/api/documents')
      .then(r => setDocs(r.data))
      .catch(console.error)
      .finally(() => setLoadingDocs(false))
  }, [])

  useState(() => { loadDocs() })

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert(`${file.name}: only PDF files are supported`)
        continue
      }

      const formData = new FormData()
      formData.append('file', file)

      try {
        const { data } = await axios.post('/api/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setUploads(prev => [{
          document_id : data.document_id,
          filename    : data.filename,
          status      : 'processing',
          uploaded_at : new Date().toISOString(),
        }, ...prev])
      } catch (err: any) {
        setUploads(prev => [{
          document_id : crypto.randomUUID(),
          filename    : file.name,
          status      : 'failed',
          uploaded_at : new Date().toISOString(),
        }, ...prev])
      }
    }

    setUploading(false)
    setTimeout(loadDocs, 3000)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>Documents</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Upload PDFs for entity extraction, embedding, and obligation detection
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>

        {/* Drop zone */}
        <Box
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: dragging ? 'primary.main' : 'rgba(255,255,255,0.12)',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: dragging ? 'rgba(127,119,221,0.06)' : 'rgba(255,255,255,0.01)',
            transition: 'all 0.15s ease',
            mb: 2.5,
            '&:hover': {
              borderColor: 'rgba(127,119,221,0.5)',
              bgcolor: 'rgba(127,119,221,0.04)',
            },
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={24} sx={{ color: 'primary.main' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Uploading…</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                Drop PDF files here or click to browse
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                LPAs · PSAs · loan agreements · OMs · appraisals · max 50MB each
              </Typography>
            </>
          )}
        </Box>

        {/* Recent uploads (this session) */}
        {uploads.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', display: 'block', mb: 1 }}>
              This session
            </Typography>
            <Stack gap={0.75}>
              {uploads.map(u => (
                <Paper key={u.document_id} elevation={0} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.filename}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {dayjs(u.uploaded_at).format('h:mm A')}
                    </Typography>
                  </Box>
                  {u.status === 'processing' ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CircularProgress size={12} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Processing…</Typography>
                    </Box>
                  ) : (
                    <Chip
                      label={u.status}
                      size="small"
                      sx={{
                        fontSize: '0.65rem', height: 18,
                        bgcolor: u.status === 'complete' ? 'rgba(29,158,117,0.12)' : 'rgba(226,75,74,0.12)',
                        color:   u.status === 'complete' ? '#5DCAA5' : '#E24B4A',
                      }}
                    />
                  )}
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* All documents */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary' }}>
              All documents ({docs.length})
            </Typography>
            <Typography
              variant="caption"
              onClick={loadDocs}
              sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              Refresh
            </Typography>
          </Box>

          {loadingDocs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={18} />
            </Box>
          ) : docs.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No documents uploaded yet
            </Typography>
          ) : (
            <Stack gap={0.75}>
              {docs.map((d: any) => (
                <Paper key={d.DOCUMENT_ID} elevation={0} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.4 }}>
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500, flex: 1, pr: 1 }}>
                      {d.FILENAME}
                    </Typography>
                    <Chip
                      label={d.EXTRACTION_STATUS}
                      size="small"
                      sx={{
                        fontSize: '0.6rem', height: 16, flexShrink: 0,
                        bgcolor: d.EXTRACTION_STATUS === 'COMPLETE'
                          ? 'rgba(29,158,117,0.12)' : 'rgba(136,135,128,0.1)',
                        color: d.EXTRACTION_STATUS === 'COMPLETE' ? '#5DCAA5' : '#888780',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {d.SIZE_BYTES && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {(d.SIZE_BYTES / 1024).toFixed(0)} KB
                      </Typography>
                    )}
                    {d.CREATED_AT && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {dayjs(d.CREATED_AT).format('MMM D, YYYY')}
                      </Typography>
                    )}
                    {d.BOX_URL && (
                      <Typography
                        variant="caption"
                        component="a"
                        href={d.BOX_URL}
                        target="_blank"
                        rel="noopener"
                        sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        View in Box
                      </Typography>
                    )}
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  )
}
