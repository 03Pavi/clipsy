import { Box, Card, CardContent, Typography, Button, Switch, ToggleButtonGroup, ToggleButton, Divider, Chip, List, ListItem, IconButton, TextField } from '@mui/material';
import { Smartphone, DeleteOutline, Add, QrCode, Dialpad, ChevronRight, DesktopWindows, TabletMac, SyncAlt, ContentCopy } from '@mui/icons-material';
import { useAppSelector } from '@/shared/lib/redux';
import { useState, useEffect } from 'react';
import { auth, db } from '@/shared/api/firebase';

import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface Device {
  id: string;
  deviceId: string;
  name: string;
  platform: 'mobile' | 'desktop' | 'tablet' | 'web';
  os?: string;
  browser?: string;
  status: 'online' | 'offline';
  syncEnabled: boolean;
  lastSeenAt: number;
  pairedFrom?: string;
}


export function DeviceMesh() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [pairingMode, setPairingMode] = useState(false);
  const [otpCode, setOtpCode] = useState<string[]>([]);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [targetDeviceName, setTargetDeviceName] = useState('');
  const user = useAppSelector(state => state.user.info);

  const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'devices'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const docs = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Device[];
      setDevices(docs);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleToggleSync = async (deviceId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/devices', {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({ id: deviceId, syncEnabled: !currentStatus })
      });
      if (res.ok) {
        // onSnapshot handles the update automatically
      }
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const fetchOtp = async () => {
    try {
      setLoadingOtp(true);
      const userObj = auth.currentUser;
      if (!userObj) return;
      const idToken = await userObj.getIdToken();

      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ action: 'generate' })
      });
      const data = await res.json();
      if (data.code) {
        setOtpCode(data.code.split(''));
      }
    } catch (error) {
      console.error('Failed to fetch OTP:', error);
    } finally {
      setLoadingOtp(false);
    }
  };

  useEffect(() => {
    if (pairingMode) {
      fetchOtp();
    }
  }, [pairingMode]);

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      const res = await fetch(`/api/devices?id=${deviceId}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });
      if (res.ok) {
        // onSnapshot handles the update automatically
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleManualPair = async () => {
    try {
      // 1. Verify the code
      const vRes = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: inputPin })
      });
      const vData = await vRes.json();

      if (vData.token) {
        // 2. Store the mesh ID for cross-account visibility (for anonymous users)
        if (user?.isAnonymous) {
          localStorage.setItem('clipsy_paired_mesh', vData.targetUid);
          localStorage.setItem('clipsy_paired_mesh', vData.targetUid);
          // Force a refresh of the hub listener by broadcasting a custom event if needed
          window.dispatchEvent(new Event('mesh_sync_update'));

          // 3. SIGN IN WITH TOKEN (Optional: some users might want to stay anonymous but linked)
          // For now, we continue with signing in to ensure full account access
          const { signInWithCustomToken } = await import('firebase/auth');
          const { auth: clientAuth } = await import('@/shared/api/firebase');
          await signInWithCustomToken(clientAuth, vData.token);
          const realIdToken = await clientAuth.currentUser?.getIdToken();

          // 3. Register with Identity
          const regRes = await fetch('/api/devices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${realIdToken}`
            },
            body: JSON.stringify({
              deviceId: `manual_${Date.now()}`,
              name: targetDeviceName,
              platform: targetDeviceName.toLowerCase().includes('iphone') || targetDeviceName.toLowerCase().includes('android') ? 'mobile' : 'desktop',
              os: 'Manual Link',
              browser: 'Clipsy Mesh',
              syncEnabled: true
            })
          });

          if (regRes.ok) {
            setPairingMode(false);
            setInputPin('');
            setTargetDeviceName('');
          }
        } else {
          alert('❌ Invalid pairing code. Please check and try again.');
        }
      }
    } catch (error) {
      console.error('Pairing failed:', error);
      alert('⚠️ Connectivity error. Please try again.');
    }
  };

  if (pairingMode) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncAlt sx={{ color: "var(--theme-primary)", fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700} color="var(--text-primary)">SyncFlow</Typography>
        </Box>
        <Typography variant="body2" color="var(--text-dim)">
          Securely expand your enterprise sync ecosystem by pairing a new hardware node.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, width: '100%', maxWidth: 900 }}>
          {/* Scan to Pair */}
          <Card sx={{ flex: 1, bgcolor: 'var(--theme-card-bg)', borderRadius: 4, border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: { xs: 2, md: 4 }, gap: 3 }}>
              <Box sx={{
                bgcolor: 'var(--theme-primary)',
                p: 1.5,
                borderRadius: 2,
                display: 'flex',
                boxShadow: '0 8px 16px rgba(0,112,255,0.3)'
              }}>
                <QrCode sx={{ color: "white", fontSize: 20 }} />
              </Box>
              <Typography variant="h6" fontWeight={600} color="var(--text-primary)">Scan to Pair</Typography>
              <Typography variant="caption" align="center" color="var(--text-muted)">
                Open the SyncFlow mobile app and scan the encrypted QR code below.
              </Typography>
              <Box sx={{ width: 200, height: 200, bgcolor: 'white', borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {otpCode.length > 0 ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/pair?pairingId=${otpCode.join('')}&userId=${user?.uid}&source=${encodeURIComponent('Cloud Dashboard')}`)}`}
                    alt="Sync QR Code"
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <QrCode sx={{ color: 'black', fontSize: 160, opacity: 0.1 }} />
                )}
              </Box>
              <Button
                size="small"
                startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
                onClick={() => {
                  const url = `${window.location.origin}/pair?pairingId=${otpCode.join('')}&userId=${user?.uid}&source=${encodeURIComponent('Cloud Dashboard')}`;
                  navigator.clipboard.writeText(url);
                  alert('🔗 Pairing link copied to clipboard!');
                }}
                sx={{ color: 'var(--text-dim)', textTransform: 'none', fontSize: '0.7rem', '&:hover': { color: 'var(--text-primary)' } }}
              >
                Copy Pairing Link
              </Button>
              <Chip label="WAITING FOR SCAN" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', fontSize: '0.65rem', border: '1px solid var(--theme-border)' }} />
            </CardContent>
          </Card>

          {/* Pairing PIN */}
          <Card sx={{ flex: 1.2, bgcolor: 'var(--theme-card-bg)', borderRadius: 4, border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)' }}>
            <CardContent sx={{ p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Box sx={{
                    bgcolor: 'var(--theme-primary)',
                    p: 1,
                    borderRadius: 1.5,
                    display: 'flex',
                    boxShadow: '0 8px 16px rgba(0,112,255,0.3)'
                  }}>
                    <Dialpad sx={{ color: "white", fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={600} color="var(--text-primary)">Pairing PIN</Typography>
                </Box>
                <Typography variant="caption" color="var(--text-dim)">OPTION 2</Typography>
              </Box>
              <Typography variant="caption" color="var(--text-muted)">
                Enter this 6-digit secure code on your device's setup screen to establish a trusted handshake.
              </Typography>

              <Box display="flex" gap={1.5} justifyContent="center" my={1}>
                {loadingOtp ? (
                  <Typography variant="body1">Generating code...</Typography>
                ) : (
                  otpCode.map((num, i) => (
                    <Box key={i} sx={{
                      width: 50, height: 60,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2,
                      fontSize: '1.5rem', fontWeight: 700, border: '1px solid var(--theme-border)',
                      color: 'var(--text-primary)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                      {num}
                    </Box>
                  ))
                )}
              </Box>

              <List sx={{ color: 'var(--text-muted)' }}>
                {[
                  'Power on the new SyncFlow Enterprise node and ensure it is connected to the same VLAN.',
                  'Select "Manual Pair" on the device interface and input the 6-digit code provided above.',
                  'Wait for the "Secure Uplink Established" message to appear on your Dashboard.'
                ].map((text, i) => (
                  <ListItem key={i} disablePadding sx={{ alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ minWidth: 20, height: 20, borderRadius: '50%', border: '1px solid var(--theme-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', mr: 1.5, mt: 0.2, color: 'var(--text-dim)' }}>
                      {i + 1}
                    </Box>
                    <Typography variant="caption" sx={{ lineHeight: 1.4, color: 'var(--text-muted)' }}>{text}</Typography>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ borderColor: 'var(--theme-border)', my: 1 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 1 }}>
                  OR ENTER PAIRING CODE MANUALLY
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    size="small"
                    placeholder="6-digit PIN"
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    InputProps={{
                      sx: {
                        bgcolor: 'var(--theme-card-bg)',
                        borderRadius: 2,
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-border)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary)' }
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    placeholder="Device Name"
                    value={targetDeviceName}
                    onChange={(e) => setTargetDeviceName(e.target.value)}
                    InputProps={{
                      sx: {
                        bgcolor: 'var(--theme-card-bg)',
                        borderRadius: 2,
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-border)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary)' }
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                </Box>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={inputPin.length !== 6 || !targetDeviceName.trim()}
                  onClick={handleManualPair}
                  sx={{
                    bgcolor: "var(--theme-primary)",
                    '&:hover': { bgcolor: '#0062e3' },
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  Verify & Connect Device
                </Button>
              </Box>

              <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                <Typography
                  variant="caption"
                  onClick={fetchOtp}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-dim)', '&:hover': { color: 'var(--theme-primary)' } }}
                >
                  <SyncAlt sx={{ fontSize: 14 }} /> GENERATE NEW PIN
                </Typography>
                <Button
                  variant="text"
                  onClick={() => setPairingMode(false)}
                  sx={{ color: 'var(--text-dim)', textTransform: 'none', fontSize: '0.75rem', '&:hover': { color: '#ef4444' } }}
                >
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Typography
          variant="caption"
          onClick={() => setPairingMode(false)}
          sx={{ cursor: 'pointer', color: 'var(--text-dim)', mt: 2, '&:hover': { color: 'var(--theme-primary)' }, fontWeight: 700, letterSpacing: 1 }}
        >
          ← BACK TO DASHBOARD
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, v) => v && setView(v)}
          sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', p: 0.5 }}
        >
          <ToggleButton value="grid" sx={{ color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 1.5, px: 2, py: 0.5, '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}>Grid View</ToggleButton>
          <ToggleButton value="list" sx={{ color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 1.5, px: 2, py: 0.5, '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}>List View</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {view === 'grid' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', height: 220 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                    <Box sx={{ width: 60, height: 24, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                  </Box>
                  <Box>
                    <Box sx={{ width: '70%', height: 20, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)', mb: 1, animation: 'pulse 1.5s infinite' }} />
                    <Box sx={{ width: '40%', height: 12, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s infinite' }} />
                  </Box>
                  <Box sx={{ width: '100%', height: 1, bgcolor: 'rgba(255,255,255,0.05)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ width: '50%', height: 12, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s infinite' }} />
                    <Box sx={{ width: 40, height: 20, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
                  </Box>
                </CardContent>
              </Card>
            ))
          ) : devices.map((device: Device) => (
            <Card key={device.id} sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', color: 'white' }}>
              <CardContent sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1.5, borderRadius: 2 }}>
                    {device.name.includes('Mac') ? <DesktopWindows /> : device.name.includes('iPhone') ? <Smartphone /> : <TabletMac />}
                  </Box>
                  <Chip
                    label={device.status === 'online' ? "● Online" : "● Offline"}
                    size="small"
                    sx={{
                      bgcolor: device.status === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: device.status === 'online' ? '#10b981' : 'rgba(255,255,255,0.3)',
                      fontWeight: 700, fontSize: '0.65rem'
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="h6" fontWeight={600}>{device.name}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SyncAlt sx={{ fontSize: 12, color: 'rgba(0,112,255,0.6)' }} />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                      {device.pairedFrom ? `Linked via ${device.pairedFrom}` : 'Primary Sync Hub'}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Real-time Syncing</Typography>
                  <Switch
                    checked={device.syncEnabled}
                    onChange={() => handleToggleSync(device.id, device.syncEnabled)}
                  />
                </Box>

                <Button
                  fullWidth
                  onClick={() => handleRemoveDevice(device.id)}
                  startIcon={<DeleteOutline fontSize="small" />}
                  sx={{ bgcolor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', textTransform: 'none', py: 1, borderRadius: 1.5, fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                >
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {devices.map((device: Device) => (
            <Box key={device.id} sx={{
              display: 'flex', alignItems: 'center', p: 2, px: 3,
              bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.05)', gap: 3
            }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: 1.5 }}>
                {device.name.includes('Mac') ? <DesktopWindows sx={{ fontSize: 20 }} /> : device.name.includes('iPhone') ? <Smartphone sx={{ fontSize: 20 }} /> : <TabletMac sx={{ fontSize: 20 }} />}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>{device.name}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                  {device.platform?.toUpperCase()} • Last seen {device.status === 'online' ? 'now' : '14h ago'}
                </Typography>
              </Box>
              <Box sx={{ width: 120 }}>
                <Chip
                  label={device.status?.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: device.status === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                    color: device.status === 'online' ? '#10b981' : 'rgba(255,255,255,0.3)',
                    height: 20, fontSize: '0.6rem', fontWeight: 800
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>SYNC</Typography>
                <Switch
                  size="small"
                  checked={device.syncEnabled}
                  onChange={() => handleToggleSync(device.id, device.syncEnabled)}
                />
              </Box>
              <IconButton size="small" onClick={() => handleRemoveDevice(device.id)} sx={{ color: 'rgba(239, 68, 68, 0.4)', '&:hover': { color: '#ef4444' } }}>
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Network Activity & Connect New */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, 
        gap: 3 
      }}>
        <Card sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.03)', 
          borderRadius: '20px', 
          border: '1px solid var(--theme-border)',
          minWidth: { xs: '100%', md: 400 }
        }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body1" fontWeight={600} mb={3} sx={{ color: 'var(--text-primary)' }}>Network Activity Across Devices</Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, mb: 2 }}>
              {[30, 60, 45, 90, 100, 70, 85].map((h, i) => (
                <Box key={i} sx={{ flex: 1, bgcolor: i === 4 ? 'var(--theme-primary)' : 'rgba(255,255,255,0.1)', height: `${h}%`, borderRadius: 1 }} />
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', textAlign: 'center', display: 'block' }}>
              A 24% increase in data synchronization speed observed since the last firmware update.
            </Typography>
          </CardContent>
        </Card>

        <Card
          onClick={() => setPairingMode(true)}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '20px',
            border: '2px dashed rgba(255, 255, 255, 0.05)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            minWidth: { xs: '100%', md: 240 },
            transition: 'all 0.2s',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255,255,255,0.1)' }
          }}
        >
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1.5, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Add sx={{ color: 'rgba(255,255,255,0.4)' }} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom sx={{ color: 'var(--text-primary)' }}>Connect New Device</Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', px: 4, display: 'block' }}>
              Link another workstation or mobile device to your workspace.
            </Typography>
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
