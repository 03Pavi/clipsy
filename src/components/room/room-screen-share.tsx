import { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress } from '@mui/material';
import { ScreenShare, StopScreenShare, CameraAlt, FiberManualRecord, Visibility, VisibilityOff } from '@mui/icons-material';
import { createClipboardItem } from '../../services/clipboard/create-clipboard-item';
import { useAuthStore } from '../../stores/auth-store';
import { deviceStorage } from '../../lib/device/device-storage';
import { Room } from '../../types/room.types';
import { db } from '../../config/firebase-client';
import { doc, updateDoc, setDoc, onSnapshot, collection, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

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
  const [isWatching, setIsWatching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeViewers, setActiveViewers] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
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
        activeScreenShare: {
          sharerId: user.uid,
          sharerName: user.displayName || user.email || 'Mesh Node',
          active: true,
          type,
          startedAt: Date.now()
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update broadcast status.');
    }
  };

  const stopBroadcasting = async () => {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        activeScreenShare: null
      });
      if (user) {
        const viewersRef = collection(db, 'rooms', roomId, 'screenshares', user.uid, 'viewers');
        const snap = await getDocs(viewersRef);
        const deletePromises = snap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
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

  // --- Viewer Functions ---
  const startWatching = async () => {
    if (!user || !room?.activeScreenShare) return;
    const sharerId = room.activeScreenShare.sharerId;
    setError(null);
    setIsConnecting(true);
    setIsWatching(true);

    try {
      const pc = new RTCPeerConnection(peerConnectionConfig);
      pcRef.current = pc;

      pc.ontrack = (event) => {
        setIsConnecting(false);
        if (event.streams && event.streams[0] && viewerVideoRef.current) {
          viewerVideoRef.current.srcObject = event.streams[0];
        }
      };

      const viewerDocRef = doc(db, 'rooms', roomId, 'screenshares', sharerId, 'viewers', user.uid);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = collection(viewerDocRef, 'iceCandidatesFromViewer');
          addDoc(candidatesRef, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      await setDoc(viewerDocRef, {
        offer: { type: offer.type, sdp: offer.sdp },
        viewerName: user.displayName || user.email || 'Mesh Node'
      });

      const queuedSharerCandidates: RTCIceCandidateInit[] = [];

      const unsubAnswer = onSnapshot(viewerDocRef, (docSnap) => {
        const data = docSnap.data();
        if (data?.answer && pc.signalingState !== 'stable') {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer)).then(() => {
            while (queuedSharerCandidates.length > 0) {
              const candidate = queuedSharerCandidates.shift();
              if (candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
                  console.warn('Error adding queued ICE candidate:', e);
                });
              }
            }
          }).catch(e => {
            console.error('Failed to set remote description:', e);
          });
        }
      });
      unsubscribesRef.current.push(unsubAnswer);

      const sharerCandidatesRef = collection(viewerDocRef, 'iceCandidatesFromSharer');
      const unsubIce = onSnapshot(sharerCandidatesRef, (iceSnap) => {
        iceSnap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data() as RTCIceCandidateInit;
            if (pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => {
                console.warn('Error adding ICE candidate:', e);
              });
            } else {
              queuedSharerCandidates.push(candidateData);
            }
          }
        });
      });
      unsubscribesRef.current.push(unsubIce);

    } catch (err: any) {
      setError(err.message || 'Failed to watch screen share.');
      stopWatching();
    }
  };

  const stopWatching = async () => {
    setIsWatching(false);
    setIsConnecting(false);

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];

    if (viewerVideoRef.current) {
      viewerVideoRef.current.srcObject = null;
    }

    if (user && room?.activeScreenShare) {
      try {
        const viewerDocRef = doc(
          db,
          'rooms',
          roomId,
          'screenshares',
          room.activeScreenShare.sharerId,
          'viewers',
          user.uid
        );
        await deleteDoc(viewerDocRef);
      } catch (e) {
        console.error('Failed to delete viewer document:', e);
      }
    }
  };

  // Capture screenshot from either local stream or WebRTC stream
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

      // Convert to compressed webp base64 directly from canvas
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

  // --- Broadcaster signaling manager ---
  useEffect(() => {
    if (!stream || !user || !room?.activeScreenShare || room.activeScreenShare.sharerId !== user.uid) {
      return;
    }

    const peerConnections: { [viewerId: string]: RTCPeerConnection } = {};
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

  // Viewer cleanup on room broadcast stop
  useEffect(() => {
    if (isWatching && (!room?.activeScreenShare || !room.activeScreenShare.active)) {
      stopWatching();
    }
  }, [room?.activeScreenShare, isWatching]);

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
      router.replace(`/room?id=${roomId}`);
    } else if (autoAction === 'streamchat') {
      startCameraCall().catch(console.error);
      router.replace(`/room?id=${roomId}`);
    } else if (autoAction === 'watch') {
      startWatching().catch(console.error);
      router.replace(`/room?id=${roomId}`);
    }
  }, [autoAction, room, user, roomId]);

  if (!isSupported) {
    return null;
  }

  const isSomeoneElseSharing = room?.activeScreenShare?.active && room.activeScreenShare.sharerId !== user?.uid;
  const isCurrentSharer = stream !== null;

  return (
    <Box sx={{ mb: 4 }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>

      {/* 2. Broadcaster View: Current user is sharing */}
      {isCurrentSharer && (
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
          <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', bgcolor: '#000' }}>
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
                Capturing at high fidelity. Press <b>Snapshot & Sync</b> to update the clipboard history.
              </Typography>
              {activeViewers.length === 0 ? (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block' }}>
                  No active viewers. Share your sync code to let other nodes watch live.
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

              <Button
                variant="contained"
                onClick={() => captureFrame(videoRef.current)}
                disabled={isCapturing}
                startIcon={isCapturing ? <CircularProgress size={18} color="inherit" /> : <CameraAlt />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: '#0070f3',
                  boxShadow: '0 4px 14px rgba(0, 112, 243, 0.3)',
                  flexGrow: { xs: 1, sm: 0 },
                  '&:hover': {
                    bgcolor: '#005cc5',
                    boxShadow: '0 6px 20px rgba(0, 112, 243, 0.4)'
                  }
                }}
              >
                {isCapturing ? 'Syncing...' : 'Sync'}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 3. Viewer View: Someone else is sharing */}
      {isSomeoneElseSharing && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            bgcolor: '#111622',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            position: 'relative',
            p: !isWatching ? 4 : 0,
            background: !isWatching ? 'radial-gradient(circle at top right, rgba(0, 198, 255, 0.05), transparent 60%)' : '#111622'
          }}
        >
          {!isWatching ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 60,
                  height: 60,
                  borderRadius: 3,
                  background: 'rgba(0, 198, 255, 0.1)',
                  border: '1px solid rgba(0, 198, 255, 0.2)',
                  color: '#00c6ff',
                  mb: 2,
                  boxShadow: '0 8px 32px rgba(0, 198, 255, 0.15)',
                  animation: 'pulse 2s infinite ease-in-out'
                }}
              >
                <Visibility sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', mb: 1 }}>
                Live Stream Discovery
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 460, mb: 3 }}>
                <b>{room?.activeScreenShare?.sharerName}</b> is currently broadcasting their {room?.activeScreenShare?.type === 'camera' ? 'camera and audio' : 'screen'} in this room. Connect to view the live broadcast.
              </Typography>

              {error && (
                <Typography variant="caption" sx={{ color: '#ffb4ab', mb: 2, display: 'block' }}>
                  {error}
                </Typography>
              )}

              <Button
                variant="contained"
                onClick={startWatching}
                startIcon={<Visibility />}
                sx={{
                  py: 1.5,
                  px: 3,
                  borderRadius: 2,
                  fontWeight: 600,
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #0070f3, #00c6ff)',
                  boxShadow: '0 4px 14px rgba(0, 112, 243, 0.4)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 20px rgba(0, 112, 243, 0.5)',
                  }
                }}
              >
                Watch Live Stream
              </Button>
            </Box>
          ) : (
            <Box>
              <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', bgcolor: '#000' }}>
                <video
                  ref={viewerVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />

                {isConnecting && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(10,13,20,0.85)',
                      zIndex: 5
                    }}
                  >
                    <CircularProgress size={44} sx={{ mb: 2, color: '#00c6ff' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                      Connecting to Live Broadcast...
                    </Typography>
                  </Box>
                )}

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
                      color: '#00c6ff',
                      fontSize: 12,
                      animation: 'pulse 1.5s infinite ease-in-out'
                    }}
                  />
                  <Typography variant="caption" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)', letterSpacing: '0.5px' }}>
                    RECEIVING {room?.activeScreenShare?.type === 'camera' ? 'VIDEO CALL' : 'SCREEN SHARE'} - {room?.activeScreenShare?.sharerName.toUpperCase()}
                  </Typography>
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
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  Viewing broadcast node. Press <b>Snapshot & Sync</b> to grab frames into the room mesh.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
                  <Button
                    variant="outlined"
                    onClick={stopWatching}
                    startIcon={<VisibilityOff />}
                    sx={{
                      borderRadius: 2,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      textTransform: 'none',
                      fontWeight: 600,
                      flexGrow: { xs: 1, sm: 0 },
                      '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        bgcolor: 'rgba(255, 255, 255, 0.05)'
                      }
                    }}
                  >
                    Disconnect
                  </Button>

                  <Button
                    variant="contained"
                    onClick={() => captureFrame(viewerVideoRef.current)}
                    disabled={isCapturing || isConnecting}
                    startIcon={isCapturing ? <CircularProgress size={18} color="inherit" /> : <CameraAlt />}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      bgcolor: '#0070f3',
                      boxShadow: '0 4px 14px rgba(0, 112, 243, 0.3)',
                      flexGrow: { xs: 1, sm: 0 },
                      '&:hover': {
                        bgcolor: '#005cc5',
                        boxShadow: '0 6px 20px rgba(0, 112, 243, 0.4)'
                      }
                    }}
                  >
                    {isCapturing ? 'Syncing...' : 'Sync'}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
