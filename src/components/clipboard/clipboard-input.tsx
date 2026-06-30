import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip, Typography, Paper } from '@mui/material';
import { Send, Code, Image as ImageIcon, Title, AttachFile, InsertDriveFile } from '@mui/icons-material';
import { createClipboardItem } from '../../services/clipboard/create-clipboard-item';
import { uploadClipboardFile } from '../../services/clipboard/upload-clipboard-file';
import { useAuthStore } from '../../stores/auth-store';
import { deviceStorage } from '../../lib/device/device-storage';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Editor from '@monaco-editor/react';
import { encodeImage } from '../../lib/image-utils';

type InputMode = 'text' | 'code' | 'image' | 'file';

export default function ClipboardInput({ roomId }: { roomId: string }) {
  const [mode, setMode] = useState<InputMode>('text');
  const [codeContent, setCodeContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [editorText, setEditorText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setEditorText(editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  const handleSend = async () => {
    if (!user) return;
    
    if (mode === 'text' && editorText.trim() && editor) {
      await createClipboardItem({
        roomId,
        type: 'text',
        content: editor.getHTML(),
        createdByUserId: user.uid,
        createdByDeviceId: deviceStorage.getDeviceId(),
        createdAt: Date.now()
      });
      editor.commands.setContent('');
      setEditorText('');
    } else if (mode === 'code' && codeContent.trim()) {
      await createClipboardItem({
        roomId,
        type: 'code',
        content: codeContent,
        createdByUserId: user.uid,
        createdByDeviceId: deviceStorage.getDeviceId(),
        createdAt: Date.now()
      });
      setCodeContent('');
    } else if (mode === 'image' && file) {
      try {
        // Create an object URL to get image dimensions before uploading
        const url = URL.createObjectURL(file);
        const img = new window.Image();

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        const width = img.width;
        const height = img.height;
        URL.revokeObjectURL(url);

        const result = await uploadAttachment(file);

        await createClipboardItem({
          roomId,
          type: 'image',
          content: file.name,
          fileUrl: result.url,
          filePath: result.id,
          mimeType: result.mimeType,
          size: result.size,
          width,
          height,
          createdByUserId: user.uid,
          createdByDeviceId: deviceStorage.getDeviceId(),
          createdAt: Date.now()
        });
      } catch (err) {
        console.error('Failed to upload image:', err);
      }
      setFile(null);
      setMode('text');
    } else if (mode === 'file' && file) {
      try {
        const result = await uploadAttachment(file);
        await createClipboardItem({
          roomId,
          type: 'file',
          content: file.name,
          fileUrl: result.url,
          filePath: result.id, // using ID as path reference
          mimeType: result.mimeType,
          size: result.size,
          createdByUserId: user.uid,
          createdByDeviceId: deviceStorage.getDeviceId(),
          createdAt: Date.now()
        });
      } catch (err) {
        console.error('Failed to upload file:', err);
      }
      setFile(null);
      setMode('text');
    } else if (mode === 'file' && file) {
      try {
        const result = await uploadClipboardFile(roomId, file);
        await createClipboardItem({
          roomId,
          type: 'file',
          content: file.name,
          fileUrl: result.url,
          filePath: result.path,
          mimeType: file.type,
          size: file.size,
          createdByUserId: user.uid,
          createdByDeviceId: deviceStorage.getDeviceId(),
          createdAt: Date.now()
        });
      } catch (err) {
        console.error('Failed to upload file:', err);
      }
      setFile(null);
      setMode('text');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (selectedFile.type === 'application/pdf') {
        setMode('file');
      } else {
        setMode('image');
      }
    }
  };

  return (
    <Box>
      <style>{`
        .tiptap-editor {
          min-height: 80px;
          outline: none;
          color: var(--foreground);
          padding: 8px;
        }
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #888;
          pointer-events: none;
          height: 0;
        }
      `}</style>
      
      <Paper 
        elevation={0} 
        sx={{ 
          border: '1px solid', 
          borderColor: 'divider', 
          borderRadius: 3,
          bgcolor: 'background.default',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 2, minHeight: 120 }}>
          {mode === 'text' && (
            <EditorContent editor={editor} />
          )}
          {mode === 'code' && (
            <Editor
              height="200px"
              theme="vs-dark"
              defaultLanguage="javascript"
              value={codeContent}
              onChange={(val) => setCodeContent(val || '')}
              options={{ minimap: { enabled: false }, padding: { top: 16 } }}
            />
          )}
          {mode === 'image' && (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              justifyContent="center"
              height={120}
              sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}
            >
              {file ? (
                <Typography color="text.primary">{file.name}</Typography>
              ) : (
                <Typography color="text.secondary">Select an image using the toolbar below</Typography>
              )}
            </Box>
          )}
          {mode === 'file' && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              height={120}
              sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}
            >
              <InsertDriveFile sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              {file ? (
                <Typography color="text.primary">{file.name}</Typography>
              ) : (
                <Typography color="text.secondary">Select a file using the toolbar below</Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Toolbar */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 1,
            bgcolor: 'action.hover',
            borderTop: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box display="flex" gap={1}>
            <Tooltip title="Rich Text">
              <IconButton 
                size="small" 
                onClick={() => setMode('text')}
                color={mode === 'text' ? 'primary' : 'default'}
              >
                <Title fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Code Snippet">
              <IconButton 
                size="small" 
                onClick={() => setMode('code')}
                color={mode === 'code' ? 'primary' : 'default'}
              >
                <Code fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Attach File">
              <IconButton 
                size="small" 
                onClick={() => fileInputRef.current?.click()}
                color={mode === 'image' || mode === 'file' ? 'primary' : 'default'}
              >
                <AttachFile fontSize="small" />
              </IconButton>
            </Tooltip>
            <input 
              type="file" 
              hidden 
              ref={fileInputRef} 
              accept="image/*,application/pdf"
              onChange={handleFileChange} 
            />
          </Box>
          <IconButton 
            onClick={handleSend} 
            disabled={(mode === 'text' && !editorText.trim()) || (mode === 'code' && !codeContent.trim()) || (mode === 'image' && !file) || (mode === 'file' && !file)}
            sx={{ 
              bgcolor: 'primary.main', 
              color: 'primary.contrastText', 
              borderRadius: 2,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
            }}
          >
            <Send fontSize="small" />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
}
