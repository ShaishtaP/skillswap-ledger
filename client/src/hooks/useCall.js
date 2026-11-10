import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

/**
 * Runs a 1-to-1 video call for a booking with WebRTC.
 *
 * - The camera/microphone stream (`localStream`) is passed in by the page.
 * - The server (via Socket.IO) only introduces the two browsers and passes
 *   their connection details back and forth ("signaling").
 * - Audio and video then flow directly between the browsers, encrypted.
 *
 * Phases: idle → joining → waiting (alone) → connecting → connected → left
 */
export function useCall(bookingId) {
  const socket = useSocket();
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connection, setConnection] = useState('new'); // RTCPeerConnection.connectionState
  const [sharing, setSharing] = useState(false);

  // Values the WebRTC callbacks need without re-rendering.
  const ref = useRef({ pc: null, local: null, screen: null, polite: false, iceServers: [], makingOffer: false, ignoreOffer: false, pending: [], joined: false });

  const send = useCallback((data) => socket?.emit('call:signal', { bookingId, data }), [socket, bookingId]);

  const closePeer = useCallback(() => {
    const r = ref.current;
    if (r.pc) {
      r.pc.ontrack = r.pc.onicecandidate = r.pc.onnegotiationneeded = r.pc.onconnectionstatechange = null;
      r.pc.close();
      r.pc = null;
    }
    setRemoteStream(null);
    setConnection('new');
  }, []);

  // Messages from the other browser: an offer/answer ("description") or a
  // network route ("candidate"). This is the standard "perfect negotiation"
  // pattern: if both sides send an offer at the same moment, the polite side
  // (the learner) accepts the other's offer and drops its own.
  const handleSignal = useCallback(
    async (data) => {
      const r = ref.current;
      const pc = r.pc;
      if (!pc) return r.pending.push(data);
      try {
        if (data.description) {
          const collision = data.description.type === 'offer' && (r.makingOffer || pc.signalingState !== 'stable');
          r.ignoreOffer = !r.polite && collision;
          if (r.ignoreOffer) return;
          await pc.setRemoteDescription(data.description);
          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            send({ description: pc.localDescription });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!r.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error('Call signaling error', err);
      }
    },
    [send],
  );

  // A fresh connection to the other person. Called when both are present.
  const createPeer = useCallback(() => {
    closePeer();
    const r = ref.current;
    const pc = new RTCPeerConnection({ iceServers: r.iceServers });
    r.pc = pc;

    r.local.getTracks().forEach((track) => pc.addTrack(track, r.local));
    // No camera or mic? Still ask to *receive* the other person's video and
    // audio, so someone can join just to watch and listen.
    if (!r.local.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
    if (!r.local.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
    if (r.screen) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(r.screen.getVideoTracks()[0]);
    }

    pc.ontrack = ({ streams }) => setRemoteStream(streams[0]);
    pc.onicecandidate = ({ candidate }) => candidate && send({ candidate });
    pc.onnegotiationneeded = async () => {
      try {
        r.makingOffer = true;
        await pc.setLocalDescription();
        send({ description: pc.localDescription });
      } catch (err) {
        console.error('Could not create an offer', err);
      } finally {
        r.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      setConnection(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setPhase('connected');
        socket.emit('call:connected', { bookingId });
      } else if (pc.connectionState === 'disconnected') {
        socket.emit('call:disconnected', { bookingId });
      } else if (pc.connectionState === 'failed') {
        // The network changed (e.g. Wi-Fi → mobile data): look for a new route.
        socket.emit('call:disconnected', { bookingId });
        pc.restartIce();
      }
    };

    // Messages that arrived before this connection existed.
    const queued = r.pending.splice(0);
    queued.forEach(handleSignal);
  }, [bookingId, closePeer, handleSignal, send, socket]);

  const join = useCallback(
    async (localStream) => {
      if (!socket) return;
      const r = ref.current;
      r.local = localStream;
      setPhase('joining');
      setError(null);
      const res = await socket.emitWithAck('call:join', { bookingId });
      if (!res.ok) {
        setError(res.error);
        setPhase('error');
        return;
      }
      r.joined = true;
      r.polite = res.polite;
      r.iceServers = res.iceServers;
      if (res.peerPresent) {
        setPhase('connecting');
        createPeer();
      } else {
        setPhase('waiting');
      }
    },
    [socket, bookingId, createPeer],
  );

  const stopSharing = useCallback(() => {
    const r = ref.current;
    if (!r.screen) return;
    r.screen.getTracks().forEach((t) => t.stop());
    r.screen = null;
    const sender = r.pc?.getSenders().find((s) => s.track?.kind === 'video');
    sender?.replaceTrack(r.local?.getVideoTracks()[0] ?? null);
    setSharing(false);
  }, []);

  const shareScreen = useCallback(async () => {
    const r = ref.current;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      r.screen = screen;
      // Swap the camera for the screen without restarting the call.
      const sender = r.pc?.getSenders().find((s) => s.track?.kind === 'video');
      await sender?.replaceTrack(track);
      track.onended = stopSharing; // the browser's own "Stop sharing" button
      setSharing(true);
    } catch {
      // The user closed the screen picker: nothing to do.
    }
  }, [stopSharing]);

  const leave = useCallback(() => {
    const r = ref.current;
    if (r.joined) socket?.emit('call:leave', { bookingId });
    r.joined = false;
    stopSharing();
    closePeer();
    r.local?.getTracks().forEach((t) => t.stop());
    setPhase('left');
  }, [socket, bookingId, stopSharing, closePeer]);

  // Listen to the server while this call is open.
  useEffect(() => {
    if (!socket) return undefined;
    const r = ref.current;
    const forThisCall = (fn) => (event) => event?.bookingId === bookingId && fn(event);

    const onSignal = forThisCall(({ data }) => handleSignal(data));
    const onPeerJoined = forThisCall(() => {
      setPhase('connecting');
      createPeer();
    });
    const onPeerLeft = forThisCall(() => {
      closePeer();
      setPhase('waiting');
    });
    const onReplaced = forThisCall(() => {
      r.joined = false;
      leave();
      setError({ message: 'You joined this call from another tab.' });
    });
    // If our connection to the server drops and comes back, rejoin the room.
    const onReconnect = async () => {
      if (!r.joined) return;
      const res = await socket.emitWithAck('call:join', { bookingId });
      if (res.ok) r.iceServers = res.iceServers;
    };

    socket.on('call:signal', onSignal);
    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:peer-left', onPeerLeft);
    socket.on('call:replaced', onReplaced);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('call:signal', onSignal);
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:peer-left', onPeerLeft);
      socket.off('call:replaced', onReplaced);
      socket.io.off('reconnect', onReconnect);
    };
  }, [socket, bookingId, handleSignal, createPeer, closePeer, leave]);

  // Leaving the page hangs up (only if we actually joined: in development
  // React mounts components twice, and that must not end the call).
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(
    () => () => {
      if (ref.current.joined) leaveRef.current();
    },
    [],
  );

  return { phase, error, remoteStream, connection, sharing, join, leave, shareScreen, stopSharing };
}
