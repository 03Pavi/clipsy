import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip, Typography, Paper } from '@mui/material';
import { Send, Code, Image as ImageIcon, Title } from '@mui/icons-material';
import { createClipboardItem } from '../../services/clipboard/create-clipboard-item';
import { useAuthStore } from '../../stores/auth-store';
import { deviceStorage } from '../../lib/device/device-storage';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Editor from '@monaco-editor/react';

type InputMode = 'text' | 'code' | 'image';

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
      await createClipboardItem({
        roomId,
        type: 'image',
        content: file.name,
        fileUrl: URL.createObjectURL(file), // Mock URL for local preview until uploaded
        createdByUserId: user.uid,
        createdByDeviceId: deviceStorage.getDeviceId(),
        createdAt: Date.now()
      });
      setFile(null);
      setMode('text');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMode('image');
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
            <Tooltip title="Attach Image">
              <IconButton 
                size="small" 
                onClick={() => fileInputRef.current?.click()}
                color={mode === 'image' ? 'primary' : 'default'}
              >
                <ImageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <input 
              type="file" 
              hidden 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </Box>
          <IconButton 
            onClick={handleSend} 
            disabled={(mode === 'text' && !editorText.trim()) || (mode === 'code' && !codeContent.trim()) || (mode === 'image' && !file)}
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
