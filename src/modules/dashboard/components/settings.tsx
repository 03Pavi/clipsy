import { Box, Card, CardContent, Typography, Button, Switch, Divider, Chip, List, ListItem, Badge, Grid } from '@mui/material';
import { Security, History, Keyboard, Info, CheckCircle, Sync, Save, Palette } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux';
import { setPreviewTheme } from '@/entities/user';
import { auth } from '@/shared/api/firebase';

export function Settings() {
  const [settings, setSettings] = useState({
    autoSync: true,
    encryption: false,
    theme: 'dark',
    hotkeys: {
      forceSync: '⌘ S',
      openDashboard: '⌘ D',
      togglePrivacy: '⌥ P',
      clearLogs: '⌃ C'
    }
  });
  const [stats, setStats] = useState({ cacheSize: '0 KB', lastSync: 'Never' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const user = useAppSelector(state => state.user.info);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!recordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keys = [];
      if (e.metaKey || e.ctrlKey) keys.push('⌘');
      if (e.altKey) keys.push('⌥');
      if (e.shiftKey) keys.push('⇧');

      const key = e.key.toUpperCase();
      if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) {
        keys.push(key);
        const finalKey = keys.join(' ');
        setSettings(prev => ({
          ...prev,
          hotkeys: { ...prev.hotkeys, [recordingKey]: finalKey }
        }));
        setRecordingKey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingKey]);

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // Fetch Settings
        const res = await fetch('/api/user', { headers: await getHeaders() });
        const data = await res.json();
        if (data.user) {
          setSettings(prev => ({ ...prev, ...data.user }));
        }

        // Fetch Stats (Mocked based on real clip count)
        const clipsRes = await fetch('/api/clipboard', { headers: await getHeaders() });
        const clipsData = await clipsRes.json();
        const count = clipsData.items?.length || 0;
        setStats({
          cacheSize: `${(count * 1.4).toFixed(1)} MB`,
          lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ago'
        });
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await fetch('/api/user', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(settings)
      });
      // Update global theme after successful save
      dispatch(setPreviewTheme(settings.theme));
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', pb: 10 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3 }}>
        {/* Left Column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Sync & Security Protocols */}
          <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ bgcolor: 'rgba(0,112,255,0.1)', p: 1, borderRadius: 1.5 }}>
                  <Security sx={{ color: "var(--theme-primary)", fontSize: 20 }} />
                </Box>
                <Typography variant="h6" sx={{ color: "var(--light-text)", fontWeight: 600 }}>Sync & Security Protocols</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body1" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>Auto-sync Cloud State</Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mt: 0.5, maxWidth: 300 }}>
                      Automatically synchronize all local device states to the enterprise cloud every 30 seconds.
                    </Typography>
                  </Box>
                  <Switch
                    checked={settings.autoSync}
                    onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
                  />
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>End-to-end Encryption</Typography>
                      <Chip label="AES-256" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.6rem', height: 18 }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mt: 0.5, maxWidth: 300 }}>
                      Encrypt all data packets before they leave your local network. Requires local key management.
                    </Typography>
                  </Box>
                  <Switch
                    checked={settings.encryption}
                    onChange={(e) => setSettings({ ...settings, encryption: e.target.checked })}
                  />
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="body1" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>Selective Directory Sync</Typography>
                    <Typography variant="caption" sx={{ color: "var(--theme-primary)", cursor: 'pointer' }}>Manage Paths</Typography>
                  </Box>
                  <Typography variant="caption" color="rgba(255,255,255,0.4)" sx={{ display: 'block', mb: 2 }}>
                    Choose which workspaces are eligible for background updates.
                  </Typography>
                  <Box display="flex" gap={1.5}>
                    {['/production/deploy', '/user/workspace'].map((path) => (
                      <Chip
                        key={path}
                        label={path}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--theme-border)', borderRadius: 1.5 }}
                      />
                    ))}
                    <Typography variant="caption" sx={{ color: 'var(--text-muted)', mt: 1 }}>+ 3 more</Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Data & History */}
          <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ bgcolor: 'rgba(255,100,50,0.1)', p: 1, borderRadius: 1.5 }}>
                  <History sx={{ color: '#ff6432', fontSize: 20 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>Data & History</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                Manage your local logs and cache to free up space or clear sensitive audit trails.
              </Typography>

              <Box display="flex" gap={3}>
                <Box sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid var(--theme-border)' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>CACHE SIZE</Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 1, color: 'var(--text-primary)' }}>{stats.cacheSize}</Typography>
                  <Button fullWidth sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.05)', color: 'white', textTransform: 'none', borderRadius: 1.5 }}>Optimize Cache</Button>
                </Box>
                <Box sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid var(--theme-border)' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>LAST SYNC</Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 1, color: 'var(--text-primary)' }}>{stats.lastSync}</Typography>
                  <Button fullWidth sx={{ mt: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', textTransform: 'none', borderRadius: 1.5 }}>Clear History</Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right Column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Appearance */}
          <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ bgcolor: 'rgba(168,85,247,0.1)', p: 1, borderRadius: 1.5 }}>
                  <Palette sx={{ color: '#a855f7', fontSize: 20 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>Appearance</Typography>
              </Box>

              <Grid container spacing={1}>
                {[
                  { id: 'space', label: 'Deep Space', primary: '#0070ff', bg: '#050914' },
                  { id: 'violet', label: 'Midnight Violet', primary: '#a855f7', bg: '#0c0714' },
                  { id: 'emerald', label: 'Emerald Mesh', primary: '#10b981', bg: '#061410' },
                  { id: 'amber', label: 'Cyber Amber', primary: '#f59e0b', bg: '#141107' }
                ].map((t) => (
                  <Grid item xs={6} key={t.id}>
                    <Box
                      onClick={() => {
                        setSettings({ ...settings, theme: t.id });
                      }}
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: `2px solid ${settings.theme === t.id ? t.primary : 'rgba(255,255,255,0.05)'}`,
                        bgcolor: t.bg,
                        transition: 'all 0.2s',
                        '&:hover': { transform: 'scale(1.02)' }
                      }}
                    >
                      <Box sx={{ width: '100%', height: 40, bgcolor: t.primary, borderRadius: 1, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, display: 'block', textAlign: 'center' }}>{t.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Hotkeys */}
          <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ bgcolor: 'rgba(0,112,255,0.1)', p: 1, borderRadius: 1.5 }}>
                  <Keyboard sx={{ color: "var(--theme-primary)", fontSize: 20 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>Hotkeys</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { id: 'forceSync', label: 'Force Sync', key: settings.hotkeys.forceSync },
                  { id: 'openDashboard', label: 'Open Dashboard', key: settings.hotkeys.openDashboard },
                  { id: 'togglePrivacy', label: 'Toggle Privacy', key: settings.hotkeys.togglePrivacy },
                  { id: 'clearLogs', label: 'Clear Logs', key: settings.hotkeys.clearLogs }
                ].map((item) => (
                  <Box key={item.label} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{item.label}</Typography>
                    <Chip
                      label={recordingKey === item.id ? 'Press Keys...' : item.key}
                      onClick={() => setRecordingKey(item.id)}
                      size="small"
                      sx={{
                        bgcolor: recordingKey === item.id ? 'rgba(0,112,255,0.2)' : 'rgba(255,255,255,0.05)',
                        color: recordingKey === item.id ? 'white' : 'rgba(0,112,255,0.8)',
                        border: `1px solid ${recordingKey === item.id ? "var(--theme-primary)" : 'rgba(0,112,255,0.2)'}`,
                        borderRadius: 1,
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: 'rgba(0,112,255,0.1)' }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Bottom Bar */}
      <Box sx={{
        position: 'fixed', bottom: 0, right: 0, left: 260,
        p: 3, bgcolor: '#050914', borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100
      }}>
        <Box display="flex" gap={4} alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircle sx={{ color: 'var(--text-muted)', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>Privacy Compliant (GDPR/SOC2)</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Info sx={{ color: 'var(--text-muted)', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>v2.4.0 Stable Build</Typography>
          </Box>
        </Box>

        <Box display="flex" gap={2}>
          <Button variant="text" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none', fontSize: '0.85rem' }}>Export Logs</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: 'none', bgcolor: 'var(--theme-primary)', borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
