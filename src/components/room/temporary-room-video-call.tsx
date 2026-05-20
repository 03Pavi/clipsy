'use client';
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Grid, Paper, Avatar, Stack, CircularProgress, Button, TextField, InputAdornment, List, ListItem, ListItemAvatar, ListItemText, Badge } from '@mui/material';
import { Mic, MicOff, Videocam, VideocamOff, ScreenShare, StopScreenShare, CallEnd, GridView, Speaker, Chat, People, Search, InfoOutlined } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where, onSnapshot, setDoc, updateDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { deviceStorage } from '../../lib/device/device-storage';

const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

interface TemporaryRoomVideoCallProps {
  room: any;
  roomId: string;
  user: any;
  onLeave: () => void;
}

export default function TemporaryRoomVideoCall({ room, roomId, user, onLeave }: TemporaryRoomVideoCallProps) {
  const router = useRouter();

  // Media States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layout & Sidebar States
  const [isGridView, setIsGridView] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [searchQuery, setSearchQuery] = useState('');
  const [roomParticipants, setRoomParticipants] = useState<any[]>([]);

  // Refs for WebRTC & Elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const broadcasterPcRef = useRef<{ [viewerId: string]: RTCPeerConnection }>({});
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const localUnsubscribesRef = useRef<(() => void)[]>([]);
  const otherUserUnsubRef = useRef<(() => void) | null>(null);

  // 1. Get other participant & active devices
  useEffect(() => {
    if (!roomId) return;
    const participantsRef = collection(db, 'rooms', roomId, 'participants');
    const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRoomParticipants(list);
    });
    return () => unsubscribe();
  }, [roomId]);

  // 2. Automate Local Stream Capture and Broadcast
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startLocalStream = async () => {
      try {
        setError(null);
        // Automatically request both audio and video permission on entry
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });
        activeStream = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Start broadcasting our media stream to Firestore
        await startBroadcasting(stream);

        // Listen for the other user's broadcast metadata in this room
        listenForRemoteBroadcast();
      } catch (err: any) {
        console.error('Error starting camera feed:', err);
        setError('Failed to access camera and microphone. Please ensure permissions are granted.');
        setIsConnecting(false);
      }
    };

    startLocalStream();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      stopBroadcastingDb();
      if (otherUserUnsubRef.current) otherUserUnsubRef.current();
      localUnsubscribesRef.current.forEach((unsub) => unsub());
      if (viewerPcRef.current) viewerPcRef.current.close();
      Object.values(broadcasterPcRef.current).forEach((pc) => pc.close());
    };
  }, [roomId, user]);

  // Keep local video element in sync with the media stream across layout switches
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isGridView]);

  // Keep remote video element in sync with the media stream across layout switches
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isGridView, isConnecting]);

  // --- WebRTC BROADCASTER SIGNALLING ---
  const startBroadcasting = async (stream: MediaStream) => {
    if (!user) return;
    const sharerId = user.uid;
    const shareDocRef = doc(db, 'rooms', roomId, 'screenshares', sharerId);

    // Create the active screenshare/camera broadcast metadata
    await setDoc(shareDocRef, {
      sharerId,
      sharerName: user.displayName || 'Mesh Node',
      active: true,
      type: 'camera',
      startedAt: Date.now()
    });

    const viewersRef = collection(db, 'rooms', roomId, 'screenshares', sharerId, 'viewers');

    // Reactively listen for incoming viewers (offers)
    const unsubViewers = onSnapshot(viewersRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const viewerId = change.doc.id;
        const viewerData = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          if (broadcasterPcRef.current[viewerId]) return;

          if (viewerData.offer) {
            const pc = new RTCPeerConnection(peerConnectionConfig);
            broadcasterPcRef.current[viewerId] = pc;

            // Attach tracks
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
                    pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch((e) =>
                      console.warn('ICE candidate addition failed:', e)
                    );
                  } else {
                    queuedViewerCandidates.push(candidateData);
                  }
                }
              });
            });
            localUnsubscribesRef.current.push(unsubIce);

            await pc.setRemoteDescription(new RTCSessionDescription(viewerData.offer));

            while (queuedViewerCandidates.length > 0) {
              const candidate = queuedViewerCandidates.shift();
              if (candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
                  console.warn('Queued ICE addition failed:', e)
                );
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const viewerDocRef = doc(viewersRef, viewerId);
            await updateDoc(viewerDocRef, { answer: { type: answer.type, sdp: answer.sdp } });
          }
        } else if (change.type === 'removed') {
          if (broadcasterPcRef.current[viewerId]) {
            broadcasterPcRef.current[viewerId].close();
            delete broadcasterPcRef.current[viewerId];
          }
        }
      });
    });

    localUnsubscribesRef.current.push(unsubViewers);
  };

  const stopBroadcastingDb = async () => {
    if (!user) return;
    try {
      const shareDocRef = doc(db, 'rooms', roomId, 'screenshares', user.uid);
      await deleteDoc(shareDocRef);
    } catch (e) {
      console.warn('Error deleting broadcast metadata:', e);
    }
  };

  // --- WebRTC VIEWER SIGNALLING ---
  const listenForRemoteBroadcast = () => {
    const screensharesRef = collection(db, 'rooms', roomId, 'screenshares');
    const unsub = onSnapshot(screensharesRef, (snapshot) => {
      let isRemoteActive = false;
      let activeSharerId = '';

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.active && data.sharerId !== user?.uid) {
          isRemoteActive = true;
          activeSharerId = data.sharerId;
        }
      });

      if (isRemoteActive) {
        startWatchingRemoteStream(activeSharerId);
      } else {
        // Remote stopped broadcasting: Clean up existing connection
        if (viewerPcRef.current) {
          viewerPcRef.current.close();
          viewerPcRef.current = null;
        }
        setRemoteStream(null);
        setIsConnecting(true);
      }
    });
    otherUserUnsubRef.current = unsub;
  };

  const startWatchingRemoteStream = async (sharerId: string) => {
    if (!user) return;
    if (viewerPcRef.current) return;
    setIsConnecting(true);

    try {
      const pc = new RTCPeerConnection(peerConnectionConfig);
      viewerPcRef.current = pc;

      pc.ontrack = (event) => {
        setIsConnecting(false);
        if (event.streams && event.streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      const viewerDocRef = doc(db, 'rooms', roomId, 'screenshares', sharerId, 'viewers', user.uid);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = collection(viewerDocRef, 'iceCandidatesFromViewer');
          addDoc(candidatesRef, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      await setDoc(viewerDocRef, {
        offer: { type: offer.type, sdp: offer.sdp },
        viewerName: user.displayName || 'Mesh Node'
      });

      const queuedSharerCandidates: RTCIceCandidateInit[] = [];

      const unsubAnswer = onSnapshot(viewerDocRef, (docSnap) => {
        const data = docSnap.data();
        if (data?.answer && pc.signalingState !== 'stable') {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer))
            .then(() => {
              while (queuedSharerCandidates.length > 0) {
                const candidate = queuedSharerCandidates.shift();
                if (candidate) {
                  pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
                    console.warn('ICE set error:', e)
                  );
                }
              }
            })
            .catch((e) => console.error('Failed to set remote description:', e));
        }
      });
      localUnsubscribesRef.current.push(unsubAnswer);

      const sharerCandidatesRef = collection(viewerDocRef, 'iceCandidatesFromSharer');
      const unsubIce = onSnapshot(sharerCandidatesRef, (iceSnap) => {
        iceSnap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data() as RTCIceCandidateInit;
            if (pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch((e) =>
                console.warn('ICE add error:', e)
              );
            } else {
              queuedSharerCandidates.push(candidateData);
            }
          }
        });
      });
      localUnsubscribesRef.current.push(unsubIce);
    } catch (err) {
      console.error('Error starting watch stream:', err);
    }
  };

  // --- TOGGLE CONTROLS ---
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamEnabled(videoTrack.enabled);
      }
    }
  };

  const handleHangup = async () => {
    // Stop local camera tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    await stopBroadcastingDb();

    // Evict participant record
    try {
      const deviceId = deviceStorage.getDeviceId();
      const partRef = doc(db, 'rooms', roomId, 'participants', `${user.uid}_${deviceId}`);
      await deleteDoc(partRef);
    } catch (e) {
      console.warn('Error clearing participant:', e);
    }

    // Call dynamic leave handler
    onLeave();
  };

  // Filter participants
  const filteredParticipants = roomParticipants.filter((p) =>
    p.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOtherParticipantStillPresent = roomParticipants.some(p => p.userId !== user?.uid);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        bgcolor: '#0a0d14',
        display: 'flex',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* LEFT PANEL: Massive Video Calling Stream Space */}
      <Box
        sx={{
          flexGrow: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          bgcolor: '#0d111a',
          p: 3
        }}
      >
        {/* Stream Top Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, zIndex: 10 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#fff' }}>
              {room.name || 'Private Chat Room'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ bgcolor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)', p: 0.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
            <Button
              size="small"
              onClick={() => setIsGridView(false)}
              startIcon={<Speaker sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: !isGridView ? '#fff' : 'rgba(255,255,255,0.4)',
                bgcolor: !isGridView ? 'rgba(0,112,243,0.15)' : 'transparent',
                border: !isGridView ? '1px solid rgba(0,112,243,0.3)' : '1px solid transparent',
                borderRadius: 1.5,
                px: 1.5,
                '&:hover': { bgcolor: !isGridView ? 'rgba(0,112,243,0.25)' : 'rgba(255,255,255,0.05)' }
              }}
            >
              Speaker View
            </Button>
            <Button
              size="small"
              onClick={() => setIsGridView(true)}
              startIcon={<GridView sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: isGridView ? '#fff' : 'rgba(255,255,255,0.4)',
                bgcolor: isGridView ? 'rgba(0,112,243,0.15)' : 'transparent',
                border: isGridView ? '1px solid rgba(0,112,243,0.3)' : '1px solid transparent',
                borderRadius: 1.5,
                px: 1.5,
                '&:hover': { bgcolor: isGridView ? 'rgba(0,112,243,0.25)' : 'rgba(255,255,255,0.05)' }
              }}
            >
              Grid View
            </Button>
          </Stack>
        </Stack>

        {/* Video Canvas Workspace */}
        <Box sx={{ flexGrow: 1, position: 'relative', borderRadius: 4, overflow: 'hidden', bgcolor: '#06080c', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)' }}>
          {error ? (
            <Stack justifyContent="center" alignItems="center" sx={{ height: '100%', p: 4, textAlign: 'center' }}>
              <InfoOutlined sx={{ fontSize: 48, color: '#ef4444', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>Permissions Required</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 400 }}>{error}</Typography>
            </Stack>
          ) : (!isConnecting && !isOtherParticipantStillPresent) ? (
            <Stack justifyContent="center" alignItems="center" sx={{ height: '100%', p: 4, textAlign: 'center', bgcolor: 'rgba(10, 13, 20, 0.95)', position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 40 }}>
              <CallEnd sx={{ fontSize: 64, color: '#ef4444', mb: 2, animation: 'pulseBorderIncoming 1.5s infinite ease-in-out' }} />
              <Typography variant="h5" sx={{ color: '#fff', mb: 1, fontWeight: 700 }}>Call Ended</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 400, mb: 3 }}>
                The other participant has left the call. You are the only node remaining in this temporary room.
              </Typography>
              <Button
                variant="contained"
                color="error"
                onClick={handleHangup}
                startIcon={<CallEnd />}
                sx={{
                  py: 1.5,
                  px: 4,
                  borderRadius: 3,
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: '#ef4444',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  '&:hover': { bgcolor: '#dc2626' }
                }}
              >
                Exit Meeting Room
              </Button>
            </Stack>
          ) : isGridView ? (
            /* GRID VIEW LAYOUT (Equal side-by-side) */
            <Grid container spacing={2} sx={{ height: '100%', p: 2 }}>
              <Grid item xs={12} sm={6} sx={{ height: '100%' }}>
                <Box sx={{ position: 'relative', height: '100%', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', bgcolor: '#111622' }}>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  />
                  <Box sx={{ position: 'absolute', bottom: 16, left: 16, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', px: 1.5, py: 0.6, borderRadius: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>{user?.displayName || 'Me'} (You)</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} sx={{ height: '100%' }}>
                <Box sx={{ position: 'relative', height: '100%', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', bgcolor: '#111622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isConnecting ? (
                    <Stack spacing={2} alignItems="center">
                      <CircularProgress size={36} sx={{ color: '#0070f3' }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>WAITING FOR REMOTE MESH...</Typography>
                    </Stack>
                  ) : (
                    <>
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <Box sx={{ position: 'absolute', bottom: 16, left: 16, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', px: 1.5, py: 0.6, borderRadius: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>Remote User</Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </Grid>
            </Grid>
          ) : (
            /* SPEAKER VIEW LAYOUT (Main background remote + floating local thumbnail) */
            <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
              {isConnecting ? (
                <Stack justifyContent="center" alignItems="center" sx={{ height: '100%' }} spacing={2}>
                  <CircularProgress size={44} sx={{ color: '#0070f3' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', fontWeight: 600 }}>CONNECTING SECURE PEERING LINK...</Typography>
                </Stack>
              ) : (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}

              {/* Floating Local Camera Thumb */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 24,
                  left: 24,
                  width: 220,
                  height: 140,
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                  bgcolor: '#111622',
                  zIndex: 20
                }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                <Box sx={{ position: 'absolute', bottom: 8, left: 8, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', px: 1, py: 0.3, borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}>You</Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Floating Controls Overlay Strip */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 24,
              right: '50%',
              transform: 'translateX(50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              bgcolor: 'rgba(10, 13, 20, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 5,
              px: 3,
              py: 1.5,
              zIndex: 30,
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)'
            }}
          >
            <IconButton
              onClick={toggleMic}
              sx={{
                width: 46,
                height: 46,
                bgcolor: isMicEnabled ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.25)',
                color: isMicEnabled ? '#fff' : '#ef4444',
                border: '1px solid rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: isMicEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239, 68, 68, 0.35)' }
              }}
            >
              {isMicEnabled ? <Mic /> : <MicOff />}
            </IconButton>

            <IconButton
              onClick={toggleCam}
              sx={{
                width: 46,
                height: 46,
                bgcolor: isCamEnabled ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.25)',
                color: isCamEnabled ? '#fff' : '#ef4444',
                border: '1px solid rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: isCamEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239, 68, 68, 0.35)' }
              }}
            >
              {isCamEnabled ? <Videocam /> : <VideocamOff />}
            </IconButton>

            <IconButton
              onClick={handleHangup}
              sx={{
                width: 50,
                height: 50,
                bgcolor: '#ef4444',
                color: '#fff',
                '&:hover': { bgcolor: '#dc2626', transform: 'scale(1.05)' },
                transition: 'all 0.2s'
              }}
            >
              <CallEnd />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* RIGHT PANEL: Blur Glassmorphic Participants & Chat Sidebar */}
      <Paper
        elevation={0}
        sx={{
          width: 380,
          height: '100%',
          bgcolor: '#111622',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0
        }}
      >
        {/* Sidebar Nav Tabs */}
        <Stack direction="row" spacing={1} sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Button
            fullWidth
            onClick={() => setActiveTab('participants')}
            startIcon={<People sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: activeTab === 'participants' ? '#fff' : 'rgba(255,255,255,0.4)',
              bgcolor: activeTab === 'participants' ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderRadius: 2,
              py: 1
            }}
          >
            Participants ({roomParticipants.length})
          </Button>
          <Button
            fullWidth
            onClick={() => setActiveTab('chat')}
            startIcon={<Chat sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: activeTab === 'chat' ? '#fff' : 'rgba(255,255,255,0.4)',
              bgcolor: activeTab === 'chat' ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderRadius: 2,
              py: 1
            }}
          >
            Room Chat
          </Button>
        </Stack>

        {activeTab === 'participants' ? (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
            <TextField
              size="small"
              placeholder="Search active nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  color: '#fff',
                  fontSize: '0.85rem'
                }
              }}
              sx={{ mb: 2 }}
            />

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px', textTransform: 'uppercase', mb: 1, display: 'block', fontWeight: 700 }}>
              On the Call
            </Typography>

            <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {filteredParticipants.map((part) => (
                <ListItem
                  key={part.id}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    p: 1.5
                  }}
                >
                  <ListItemAvatar>
                    <Badge variant="dot" color="success" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} overlap="circular">
                      <Avatar src={part.photoURL} sx={{ width: 36, height: 36, bgcolor: '#0070f3', fontSize: '0.9rem' }}>
                        {part.displayName?.charAt(0).toUpperCase() || 'P'}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>
                        {part.displayName} {part.userId === user?.uid && '(You)'}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                        {part.role?.toUpperCase() || 'MEMBER'} • {part.deviceName || 'Desktop Node'}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <Chat sx={{ fontSize: 44, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
            <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>Dynamic Chat Pipeline</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 220 }}>
              Peer-to-peer screen capture history takes priority inside 1:1 temporary rooms.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
