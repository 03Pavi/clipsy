import { useState } from 'react';
import { Box, ListItem, Typography, IconButton, Paper, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { ContentCopy, Download, Link as LinkIcon, Image as ImageIcon, InsertDriveFile, TextSnippet, Code, DeleteOutline, MoreVert } from '@mui/icons-material';
import { ClipboardItem as ClipboardItemType } from '../../types/clipboard.types';
import { formatDate } from '../../lib/helpers/format-date';
import Editor from '@monaco-editor/react';
import { useAuthStore } from '../../stores/auth-store';
import { deleteClipboardItem } from '../../services/clipboard/delete-clipboard-item';
import { decodeImage } from '../../lib/image-utils';

export default function ClipboardItem({ item }: { item: ClipboardItemType }) {
  const { user } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCopy = async () => {
    if (item.type === 'text' || item.type === 'link' || item.type === 'code') {
      navigator.clipboard.writeText(item.content.replace(/<[^>]*>?/gm, ''));
    } else if (item.type === 'image') {
      if (item.content.length > 100) {
        try {
          const byteCharacters = atob(item.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: item.mimeType || 'image/webp' });

          await navigator.clipboard.write([
            new (window as any).ClipboardItem({
              [blob.type]: blob
            })
          ]);
        } catch (err) {
          console.error('Failed to write true image blob, falling back to data URL text copy:', err);
          navigator.clipboard.writeText(decodeImage({ base64: item.content, mimeType: item.mimeType }));
        }
      } else if (item.fileUrl) {
        navigator.clipboard.writeText(item.fileUrl);
      }
    } else if (item.fileUrl) {
      navigator.clipboard.writeText(item.fileUrl);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this clipboard item?')) {
      try {
        await deleteClipboardItem(item.roomId, item.id);
      } catch (err) {
        console.error('Failed to delete item', err);
      }
    }
  };

  const getIcon = () => {
    switch (item.type) {
      case 'link': return <LinkIcon />;
      case 'image': return <ImageIcon />;
      case 'file': return <InsertDriveFile />;
      case 'code': return <Code />;
      default: return <TextSnippet />;
    }
  };

  return (
    <ListItem sx={{ px: 0, mb: 2 }}>
      <Paper 
        elevation={0}
        sx={{ 
          p: 2.5, 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 3,
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
          }
        }} 
      >
        <Box sx={{ color: '#0070f3', display: 'flex', p: 1, bgcolor: 'rgba(0,112,243,0.1)', borderRadius: 2 }}>
          {getIcon()}
        </Box>
        <Box flex={1} overflow="hidden">
          {item.type === 'image' ? (
            <img 
              src={item.content.length > 100 ? decodeImage({ base64: item.content, mimeType: item.mimeType }) : item.fileUrl} 
              alt="clipboard" 
              style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} 
            />
          ) : item.type === 'code' ? (
            <Box sx={{ mt: 1, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Editor
                height="150px"
                theme="vs-dark"
                defaultLanguage="javascript"
                value={item.content}
                options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false }}
              />
            </Box>
          ) : item.type === 'link' ? (
            <Typography variant="body1" sx={{ wordBreak: 'break-all', color: '#fff' }}>
              <a href={item.content} target="_blank" rel="noreferrer" style={{ color: '#00c6ff', textDecoration: 'none' }}>{item.content}</a>
            </Typography>
          ) : (
            <Typography 
              variant="body1" 
              sx={{ 
                wordBreak: 'break-all', 
                color: '#fff',
                '& p': { m: 0 } // Remove default paragraph margins from Tiptap output
              }} 
              dangerouslySetInnerHTML={{ __html: item.content }} 
            />
          )}
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.5 }}>
            {formatDate(item.createdAt)}
          </Typography>
        </Box>
        <Box>
          <IconButton size="small" onClick={handleClick} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
            <MoreVert fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              sx: {
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                backgroundImage: 'none',
                minWidth: 160
              }
            }}
          >
            {item.type !== 'image' && (
              <MenuItem onClick={() => { handleCopy(); handleClose(); }}>
                <ListItemIcon>
                  <ContentCopy fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Copy" />
              </MenuItem>
            )}
            
            {(item.type === 'image' || item.type === 'file') && (item.fileUrl || (item.type === 'image' && item.content.length > 100)) && (
              <MenuItem 
                component="a" 
                href={item.type === 'image' && item.content.length > 100 ? decodeImage({ base64: item.content, mimeType: item.mimeType }) : item.fileUrl} 
                target="_blank" 
                download={item.type === 'image' ? "clipboard-image.webp" : "download"} 
                onClick={handleClose}
              >
                <ListItemIcon>
                  <Download fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Download" />
              </MenuItem>
            )}
            
            {(user?.uid === item.createdByUserId || item.type === 'text' || item.type === 'code') && (
              <MenuItem onClick={() => { handleDelete(); handleClose(); }} sx={{ color: 'error.main' }}>
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <DeleteOutline fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Delete" />
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Paper>
    </ListItem>
  );
}
