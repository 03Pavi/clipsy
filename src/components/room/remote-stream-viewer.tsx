import { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import { CameraAlt, FiberManualRecord, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { doc, setDoc, onSnapshot, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';

const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

interface RemoteStreamViewerProps {
  roomId: string;
  sharerId: string;
  sharerName: string;
  type: 'screen' | 'camera';
  currentUserId: string;
  currentUserName: string;
  onCapture: (videoElement: HTMLVideoElement | null) => void;
  isCapturing: boolean;
}

export default function RemoteStreamViewer({ roomId, sharerId, sharerName, type, currentUserId, currentUserName, onCapture, isCapturing }: RemoteStreamViewerProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribesRef = useRef<(() => void)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const startWatching = async () => {
      setError(null);
      setIsConnecting(true);

      try {
        const pc = new RTCPeerConnection(peerConnectionConfig);
        pcRef.current = pc;

        pc.ontrack = (event) => {
          setIsConnecting(false);
          if (event.streams && event.streams[0] && viewerVideoRef.current) {
            viewerVideoRef.current.srcObject = event.streams[0];
          }
        };

        const viewerDocRef = doc(db, 'rooms', roomId, 'screenshares', sharerId, 'viewers', currentUserId);

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
          viewerName: currentUserName || 'Mesh Node'
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
        setIsConnecting(false);
      }
    };

    startWatching();

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      unsubscribesRef.current.forEach((unsub) => unsub());
      unsubscribesRef.current = [];

      const cleanupViewer = async () => {
        try {
          const viewerDocRef = doc(db, 'rooms', roomId, 'screenshares', sharerId, 'viewers', currentUserId);
          await deleteDoc(viewerDocRef);
        } catch (e) {
          console.error('Failed to delete viewer doc:', e);
        }
      };
      cleanupViewer();
    };
  }, [roomId, sharerId, currentUserId, currentUserName]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
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

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        bgcolor: '#000',
        borderRadius: isFullscreen ? 0 : 2,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
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
          <CircularProgress size={32} sx={{ mb: 2, color: '#00c6ff' }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            Connecting to {sharerName}...
          </Typography>
        </Box>
      )}

      {error && (
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
            zIndex: 5,
            p: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600 }}>
            {error}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 2,
          px: 1,
          py: 0.5,
          zIndex: 10
        }}
      >
        <FiberManualRecord
          sx={{
            color: '#00c6ff',
            fontSize: 10,
            animation: 'pulse 1.5s infinite ease-in-out'
          }}
        />
        <Typography variant="caption" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
          {sharerName} ({type})
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          display: 'flex',
          gap: 1,
          zIndex: 10
        }}
      >
        <IconButton
          size="small"
          onClick={() => onCapture(viewerVideoRef.current)}
          disabled={isCapturing || isConnecting}
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
  );
}
