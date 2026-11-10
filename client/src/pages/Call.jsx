import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import RisoArt from '../components/RisoArt.jsx';
import { Avatar, Button, ErrorNote, Field, Loading, Select, cx } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCall } from '../hooks/useCall.js';
import { api } from '../lib/api.js';
import { otherPerson } from '../lib/bookings.js';
import { formatDateTime, formatTime, relativeTime } from '../lib/format.js';

// ── Small building blocks ─────────────────────────────────────────────

function Video({ stream, muted, mirrored, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream ?? null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={cx('h-full w-full bg-ink object-cover', mirrored && '-scale-x-100', className)} />;
}

// Green bar that moves with your voice, so you know the mic works.
function useMicLevel(stream) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return undefined;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setLevel(Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 60));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      ctx.close();
    };
  }, [stream]);
  return level;
}

// Camera + microphone for the preview, with device choice.
function useLocalMedia() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState({ cameras: [], mics: [] });
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const want = (id) => (id ? { deviceId: { exact: id } } : true);
      let next = null;
      try {
        next = await navigator.mediaDevices.getUserMedia({ video: want(cameraId), audio: want(micId) });
      } catch {
        try {
          // No camera, or camera blocked: try audio only.
          next = await navigator.mediaDevices.getUserMedia({ audio: want(micId) });
        } catch (err) {
          if (!cancelled) setError(err);
          return;
        }
      }
      if (cancelled) return next.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = next;
      setStream(next);
      setError(null);
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({ cameras: all.filter((d) => d.kind === 'videoinput'), mics: all.filter((d) => d.kind === 'audioinput') });
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [cameraId, micId]);

  // Turn the camera off when leaving the page.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { stream, error, devices, cameraId, setCameraId, micId, setMicId };
}

function useNow(everyMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

const Icon = {
  mic: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  micOff: <path d="M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3" />,
  cam: <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" />,
  camOff: <path d="M3 3l18 18M15 10l6-3v10l-6-3M15 15v2H3V7h4" />,
  screen: <path d="M3 4h18v12H3zM8 20h8M12 16v4" />,
  leave: <path d="M3 15c5-4 13-4 18 0l-2 3-4-2v-2a10 10 0 0 0-6 0v2l-4 2z" />,
};

function ControlButton({ on = true, danger, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        'grid h-13 w-13 place-items-center rounded-full transition',
        danger ? 'bg-ox text-white hover:bg-ox-dark' : on ? 'bg-white/10 text-ivory hover:bg-white/20' : 'bg-ivory text-ink hover:bg-gold-soft',
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5.5 w-5.5">
        {icon}
      </svg>
    </button>
  );
}

const CONNECTION_LABEL = {
  new: ['bg-gold-2', 'Connecting…'],
  connecting: ['bg-gold-2', 'Connecting…'],
  connected: ['bg-[#5fbf7a]', 'Connected'],
  disconnected: ['bg-gold-2', 'Reconnecting…'],
  failed: ['bg-ox', 'Connection lost, retrying…'],
  closed: ['bg-muted', 'Closed'],
};

function Timer({ booking }) {
  const now = useNow(10000);
  const start = new Date(booking.startsAt).getTime();
  const end = new Date(booking.endsAt).getTime();
  const min = (ms) => Math.max(1, Math.round(ms / 60000));
  if (now < start) return <span>Starts in {min(start - now)} min</span>;
  if (now < end) return <span>{min(end - now)} min left</span>;
  return <span className="text-gold-2">Over by {min(now - end)} min</span>;
}

// ── The page ──────────────────────────────────────────────────────────

export default function Call() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useNow();
  const media = useLocalMedia();
  const call = useCall(id);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const micLevel = useMicLevel(media.stream);

  const booking = useQuery({ queryKey: ['booking', id], queryFn: () => api(`/bookings/${id}`) });
  const info = useQuery({ queryKey: ['call', id], queryFn: () => api(`/bookings/${id}/call`), refetchInterval: 30_000 });

  // Mute / camera off just pauses the track; nothing is renegotiated.
  useEffect(() => {
    media.stream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
    media.stream?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [media.stream, micOn, camOn]);

  useEffect(() => {
    if (call.phase === 'left') navigate(`/bookings/${id}`, { replace: true });
  }, [call.phase, id, navigate]);

  if (booking.isLoading || info.isLoading) return <Loading />;
  if (booking.error) return <ErrorNote error={booking.error} />;

  const b = booking.data.booking;
  const other = otherPerson(b, b.myRole);
  const otherFirst = other?.name.split(' ')[0] ?? 'the other person';
  const hasVideo = Boolean(media.stream?.getVideoTracks().length);
  const inCall = ['joining', 'waiting', 'connecting', 'connected'].includes(call.phase);
  const opensAt = info.data?.opensAt ? new Date(info.data.opensAt).getTime() : 0;
  const canJoin = info.data?.canJoin || (b.status === 'BOOKED' && opensAt && now >= opensAt);

  // ── In the call: full screen ──
  if (inCall) {
    const [dot, label] = call.phase === 'waiting' ? ['bg-gold-2', `Waiting for ${otherFirst}`] : CONNECTION_LABEL[call.connection] ?? CONNECTION_LABEL.new;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-ink text-ivory">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate font-display text-lg">{b.offerTitle}</p>
            <p className="text-sm text-[#b9b3a8]">with {other?.name}</p>
          </div>
          <div className="hidden font-mono text-sm sm:block">
            <Timer booking={b} />
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className={cx('h-2 w-2 rounded-full', dot)} />
            {label}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {call.remoteStream?.getVideoTracks().length ? (
            <Video stream={call.remoteStream} className="object-contain" />
          ) : call.phase === 'connected' ? (
            // Connected, but they have no camera: show who it is, and still play their audio.
            <div className="grid h-full place-items-center p-6 text-center">
              {call.remoteStream && <Video stream={call.remoteStream} className="hidden" />}
              <div>
                <span className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-gold-2 bg-gold-soft font-display text-4xl font-bold text-ox">
                  {other?.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </span>
                <p className="mt-6 font-display text-2xl">You're connected with {otherFirst}</p>
                <p className="mt-2 text-[#b9b3a8]">{call.remoteStream ? 'Their camera is off.' : 'They joined without a camera or microphone.'}</p>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <RisoArt offer={{ title: b.offerTitle, skills: b.skills }} className="mx-auto h-40 w-32 rounded-xl" glyphScale={0.9} />
                <p className="mt-6 font-display text-2xl">
                  {call.phase === 'waiting' ? `Waiting for ${otherFirst} to join…` : `Connecting to ${otherFirst}…`}
                </p>
                <p className="mt-2 text-[#b9b3a8]">{call.phase === 'waiting' ? "We'll connect you the moment they arrive." : 'This usually takes a few seconds.'}</p>
              </div>
            </div>
          )}

          {/* Your own camera, small in the corner */}
          <div className="absolute right-4 bottom-4 aspect-video w-36 overflow-hidden rounded-xl border border-white/20 shadow-lift sm:w-56">
            {hasVideo && camOn ? (
              <Video stream={media.stream} muted mirrored={!call.sharing} />
            ) : (
              <div className="grid h-full place-items-center bg-[#2a2d3b]">
                <Avatar name={user.name} />
              </div>
            )}
            {call.sharing && <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 font-mono text-[10px] text-ink">Sharing screen</span>}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-white/10 px-5 py-4">
          <ControlButton on={micOn} label={micOn ? 'Mute' : 'Unmute'} icon={micOn ? Icon.mic : Icon.micOff} onClick={() => setMicOn((v) => !v)} />
          {hasVideo && <ControlButton on={camOn} label={camOn ? 'Turn camera off' : 'Turn camera on'} icon={camOn ? Icon.cam : Icon.camOff} onClick={() => setCamOn((v) => !v)} />}
          {navigator.mediaDevices?.getDisplayMedia && (
            <ControlButton
              on={!call.sharing}
              label={call.sharing ? 'Stop sharing' : 'Share your screen'}
              icon={Icon.screen}
              onClick={() => (call.sharing ? call.stopSharing() : call.shareScreen())}
            />
          )}
          <ControlButton danger label="Leave call" icon={Icon.leave} onClick={call.leave} />
        </div>
      </div>
    );
  }

  // ── Before joining: check your camera and mic ──
  return (
    <div>
      <Link to={`/bookings/${id}`} className="label text-muted hover:text-ox">
        ← Back to the booking
      </Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="print relative aspect-video bg-ink">
            {hasVideo && camOn ? (
              <Video stream={media.stream} muted mirrored />
            ) : (
              <div className="grid h-full place-items-center text-ivory">
                <div className="text-center">
                  <Avatar name={user.name} size="lg" />
                  <p className="mt-3 text-sm text-[#b9b3a8]">{hasVideo ? 'Camera is off' : 'No camera found'}</p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-ink/80 to-transparent p-4">
              <ControlButton on={micOn} label={micOn ? 'Mute' : 'Unmute'} icon={micOn ? Icon.mic : Icon.micOff} onClick={() => setMicOn((v) => !v)} />
              {hasVideo && <ControlButton on={camOn} label={camOn ? 'Turn camera off' : 'Turn camera on'} icon={camOn ? Icon.cam : Icon.camOff} onClick={() => setCamOn((v) => !v)} />}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="label text-muted">Mic</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-champagne">
              <div className="h-full rounded-full bg-ok transition-[width] duration-100" style={{ width: `${micOn ? Math.round(micLevel * 100) : 0}%` }} />
            </div>
          </div>
          {media.error && (
            <ErrorNote
              className="mt-4"
              error={{ message: 'Your browser blocked the camera and microphone. Allow them using the icon in the address bar, then reload this page.' }}
            />
          )}
        </div>

        <div>
          <span className="eyebrow">Video call</span>
          <h1 className="mt-1 font-display text-4xl leading-tight text-ink">{b.offerTitle}</h1>
          <p className="mt-2 text-muted">
            with {other?.name} · {formatDateTime(b.startsAt)} – {formatTime(b.endsAt)}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {media.devices.cameras.length > 0 && (
              <Field label="Camera" htmlFor="camera">
                <Select id="camera" value={media.cameraId} onChange={(e) => media.setCameraId(e.target.value)}>
                  {media.devices.cameras.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {media.devices.mics.length > 0 && (
              <Field label="Microphone" htmlFor="mic">
                <Select id="mic" value={media.micId} onChange={(e) => media.setMicId(e.target.value)}>
                  {media.devices.mics.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {call.error && <ErrorNote className="mt-6" error={call.error} />}
          {media.error && canJoin && (
            <Button variant="secondary" className="mt-6 w-full" onClick={() => call.join(new MediaStream())}>
              Join without camera or mic
            </Button>
          )}
          <Button size="lg" className="mt-8 w-full" disabled={!canJoin || !media.stream || call.phase === 'joining'} loading={call.phase === 'joining'} onClick={() => call.join(media.stream)}>
            Join the call
          </Button>
          <p className="mt-3 text-center text-sm text-muted">
            {canJoin
              ? `${otherFirst} will see you as soon as they join.`
              : b.status !== 'BOOKED'
                ? `This session is ${b.status.toLowerCase()}, so the call is closed.`
                : `The call opens ${relativeTime(opensAt)}, 10 minutes before the start.`}
          </p>
          <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm">
            {['Your video goes straight to ' + otherFirst + ', encrypted. It never passes through our server.', 'Nothing is recorded. We only note when each of you joined and left.', 'That time on the call can back up your confirmation, or a dispute.'].map((line) => (
              <li key={line} className="flex gap-3">
                <i className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
