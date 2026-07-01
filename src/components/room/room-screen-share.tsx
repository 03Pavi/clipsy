import { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress, Grid, IconButton } from '@mui/material';
import { ScreenShare, StopScreenShare, CameraAlt, FiberManualRecord, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { createClipboardItem } from '../../services/clipboard/create-clipboard-item';
import { useAuthStore } from '../../stores/auth-store';
import { deviceStorage } from '../../lib/device/device-storage';
import { Room } from '../../types/room.types';
import { db } from '../../config/firebase-client';
import { doc, updateDoc, setDoc, onSnapshot, collection, addDoc, deleteDoc, getDocs, deleteField } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import RemoteStreamViewer from './remote-stream-viewer';

const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function RoomScreenShare({ roomId, room, autoAction }: { roomId: string, room: Room | null, autoAction?: 'screenshare' | 'streamchat' | 'watch' | null }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeViewers, setActiveViewers] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentStreamType, setCurrentStreamType] = useState<'screen' | 'camera' | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const localContainerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<{ [viewerId: string]: RTCPeerConnection }>({});
  const unsubscribesRef = useRef<(() => void)[]>([]);

  const { user } = useAuthStore();
  const router = useRouter();

  const isSupported = typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  // --- Broadcaster Functions ---
  const startBroadcasting = async (type: 'screen' | 'camera') => {
    if (!user) return;
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        [`activeStreams.${user.uid}`]: {
          sharerId: user.uid,
          sharerName: user.displayName || user.email || 'Mesh Node',
          active: true,
          type,
          startedAt: Date.now()
        }
      });
      setCurrentStreamType(type);
    } catch (err: any) {
      setError(err.message || 'Failed to update broadcast status.');
    }
  };

  const stopBroadcasting = async () => {
    try {
      if (!user) return;
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        [`activeStreams.${user.uid}`]: deleteField()
      });

      const viewersRef = collection(db, 'rooms', roomId, 'screenshares', user.uid, 'viewers');
      const snap = await getDocs(viewersRef);
      const deletePromises = snap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      setCurrentStreamType(null);
    } catch (err) {
      console.error('Failed to clear broadcast status:', err);
    }
  };

  const startShare = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: false
      });
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      await startBroadcasting('screen');

      mediaStream.getVideoTracks()[0].onended = () => {
        stopShare(mediaStream);
      };
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Failed to start screen share.');
      }
    }
  };

  const startCameraCall = async () => {
    const hasConfirmed = window.confirm("Are you sure you want to show your face cam?");
    if (!hasConfirmed) return;
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      await startBroadcasting('camera');

      mediaStream.getVideoTracks()[0].onended = () => {
        stopShare(mediaStream);
      };
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Failed to start video call. Please ensure camera and microphone permissions are granted.');
      }
    }
  };

  const stopShare = async (activeStream?: MediaStream) => {
    const currentStream = activeStream || stream;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    await stopBroadcasting();
  };

  const captureFrame = async (videoElement: HTMLVideoElement | null) => {
    if (!videoElement || !user) return;
    setIsCapturing(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      const maxDimension = 1280;
      let width = videoElement.videoWidth || 1280;
      let height = videoElement.videoHeight || 720;

      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(videoElement, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/webp', 0.5);
      const shortBase64 = compressedBase64.split(',')[1];

      await createClipboardItem({
        roomId,
        type: 'image',
        content: shortBase64,
        mimeType: 'image/webp',
        width,
        height,
        createdByUserId: user.uid,
        createdByDeviceId: deviceStorage.getDeviceId(),
        createdAt: Date.now()
      });
    } catch (err: any) {
      setError(err.message || 'Failed to capture and sync screen.');
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      localContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Broadcaster signaling manager ---
  useEffect(() => {
    if (!stream || !user || !room?.activeStreams?.[user.uid]) {
      return;
    }

    const peerConnections = pcRef.current;
    const unsubscribes: (() => void)[] = [];

    const viewersRef = collection(db, 'rooms', roomId, 'screenshares', user.uid, 'viewers');

    const unsubscribeViewers = onSnapshot(viewersRef, (snapshot) => {
      const viewersList: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.viewerName) {
          viewersList.push(data.viewerName);
        } else {
          viewersList.push('Anonymous Node');
        }
      });
      setActiveViewers(viewersList);

      snapshot.docChanges().forEach(async (change) => {
        const viewerId = change.doc.id;
        const viewerData = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          if (peerConnections[viewerId]) return;

          if (viewerData.offer) {
            const pc = new RTCPeerConnection(peerConnectionConfig);
            peerConnections[viewerId] = pc;

            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                const candidatesRef = collection(viewersRef, viewerId, 'iceCandidatesFromSharer');
                addDoc(candidatesRef, event.candidate.toJSON());
              }
            };

            const candidatesFromViewerRef = collection(viewersRef, viewerId, 'iceCandidatesFromViewer');
            const queuedViewerCandidates: RTCIceCandidateInit[] = [];

            const unsubIce = onSnapshot(candidatesFromViewerRef, (iceSnap) => {
              iceSnap.docChanges().forEach((iceChange) => {
                if (iceChange.type === 'added') {
                  const candidateData = iceChange.doc.data() as RTCIceCandidateInit;
                  if (pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => {
                      console.warn('Error adding ICE candidate:', e);
                    });
                  } else {
                    queuedViewerCandidates.push(candidateData);
                  }
                }
              });
            });
            unsubscribes.push(unsubIce);

            await pc.setRemoteDescription(new RTCSessionDescription(viewerData.offer));

            while (queuedViewerCandidates.length > 0) {
              const candidate = queuedViewerCandidates.shift();
              if (candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
                  console.warn('Error adding queued ICE candidate:', e);
                });
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const viewerDocRef = doc(viewersRef, viewerId);
            await updateDoc(viewerDocRef, { answer: { type: answer.type, sdp: answer.sdp } });
          }
        } else if (change.type === 'removed') {
          if (peerConnections[viewerId]) {
            peerConnections[viewerId].close();
            delete peerConnections[viewerId];
          }
        }
      });
    });

    return () => {
      unsubscribeViewers();
      unsubscribes.forEach((unsub) => unsub());
      Object.values(peerConnections).forEach((pc) => pc.close());
      setActiveViewers([]);
    };
  }, [stream, user, room, roomId]);

  // Broadcaster cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      stopBroadcasting();
      unsubscribesRef.current.forEach((unsub) => unsub());
    };
  }, []);

  useEffect(() => {
    if (!autoAction || !room || !user) return;
    if (autoAction === 'screenshare') {
      startShare().catch(console.error);
      router.replace(`/room/${roomId}`);
    } else if (autoAction === 'streamchat') {
      startCameraCall().catch(console.error);
      router.replace(`/room/${roomId}`);
    }
  }, [autoAction, room, user, roomId]);

  if (!isSupported) {
    return null;
  }

  const isCurrentSharer = stream !== null;
  const activeStreams = Object.values(room?.activeStreams || {}).filter(s => s.active);
  const otherStreams = activeStreams.filter(s => s.sharerId !== user?.uid);

  // If no streams are active (including local), we render nothing to save space,
  // or we could show a placeholder. Let's return null if no active streams and not currently sharing.
  if (!isCurrentSharer && otherStreams.length === 0) {
     return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>

      <Grid container spacing={2}>
        {/* Render local stream if active */}
        {isCurrentSharer && (
          <Grid item xs={12} sm={otherStreams.length > 0 ? 6 : 12}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 4,
                bgcolor: '#111622',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <Box ref={localContainerRef} sx={{ position: 'relative', width: '100%', aspectRatio: '16/9', bgcolor: '#000', borderRadius: isFullscreen ? 0 : 2, overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />

                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2,
                    px: 1.5,
                    py: 0.8,
                    zIndex: 10
                  }}
                >
                  <FiberManualRecord
                    sx={{
                      color: '#ef4444',
                      fontSize: 12,
                      animation: 'pulse 1.5s infinite ease-in-out'
                    }}
                  />
                  <Typography variant="caption" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)', letterSpacing: '0.5px' }}>
                    LIVE BROADCAST ACTIVE
                  </Typography>
                </Box>

                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    display: 'flex',
                    gap: 1,
                    zIndex: 10
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => captureFrame(videoRef.current)}
                    disabled={isCapturing}
                    sx={{
                      bgcolor: 'rgba(0, 0, 0, 0.65)',
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.85)' }
                    }}
                  >
                    {isCapturing ? <CircularProgress size={16} color="inherit" /> : <CameraAlt fontSize="small" />}
                  </IconButton>

                  <IconButton
                    size="small"
                    onClick={toggleFullscreen}
                    sx={{
                      bgcolor: 'rgba(0, 0, 0, 0.65)',
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.85)' }
                    }}
                  >
                    {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                  </IconButton>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  gap: 2,
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  bgcolor: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                    Your stream ({currentStreamType}) is live.
                  </Typography>
                  {activeViewers.length === 0 ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block' }}>
                      No active viewers.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FiberManualRecord sx={{ color: '#22c55e', fontSize: 10, animation: 'pulse 1.2s infinite ease-in-out' }} />
                      <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>
                        {activeViewers.length} {activeViewers.length === 1 ? 'Node' : 'Nodes'} Watching: {activeViewers.join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => stopShare()}
                    startIcon={<StopScreenShare />}
                    sx={{
                      borderRadius: 2,
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      textTransform: 'none',
                      fontWeight: 600,
                      flexGrow: { xs: 1, sm: 0 },
                      '&:hover': {
                        borderColor: '#ef4444',
                        bgcolor: 'rgba(239, 68, 68, 0.05)'
                      }
                    }}
                  >
                    Stop
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Render remote streams */}
        {otherStreams.map(stream => (
          <Grid item xs={12} sm={isCurrentSharer || otherStreams.length > 1 ? 6 : 12} key={stream.sharerId}>
             <Paper
                elevation={0}
                sx={{
                  borderRadius: 4,
                  bgcolor: '#111622',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  overflow: 'hidden',
                  position: 'relative'
                }}
             >
                <RemoteStreamViewer
                  roomId={roomId}
                  sharerId={stream.sharerId}
                  sharerName={stream.sharerName}
                  type={stream.type || 'screen'}
                  currentUserId={user?.uid || ''}
                  currentUserName={user?.displayName || user?.email || 'Mesh Node'}
                  onCapture={captureFrame}
                  isCapturing={isCapturing}
                />
             </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
