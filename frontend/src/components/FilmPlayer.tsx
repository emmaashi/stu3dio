"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type CSSProperties,
} from "react";
import {
  Check,
  Download,
  ExternalLink,
  LoaderCircle,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useHls } from "@/hooks/useHls";
import { usePlaybackRate } from "@/hooks/usePlaybackRate";
import styles from "./FilmPlayer.module.css";

interface FilmPlayerProps {
  src: string | null;
  poster?: string | null;
  autoplay?: boolean;
  initialRate?: number;
  title?: string;
  onClose?: () => void;
}

function formatTime(time: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours ? `${hours}:${String(minutes).padStart(2, "0")}` : minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

// A shot is often a window into a longer file (`film.webm#t=150,158`). Without
// this the player would report the whole film's length and run past the shot.
// An open-ended `#t=150` is only a start offset, so it is not a clip window.
function parseClipWindow(src: string | null) {
  const match = src && /#t=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\s*$/.exec(src);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end > start ? { start, end } : null;
}

export default function FilmPlayer(props: FilmPlayerProps) {
  // A different film starts with fresh playback, error, and buffering state.
  return <Player key={props.src || "empty"} {...props} />;
}

function Player({
  src,
  poster = process.env.NEXT_PUBLIC_FILM_POSTER || null,
  autoplay = false,
  initialRate,
  title,
  onClose,
}: FilmPlayerProps) {
  const youtubeEmbed = src && /youtube\.com\/embed\//.test(src) ? src : null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const keyboardFocus = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rawTime, setRawTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [supportsPip, setSupportsPip] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [buffered, setBuffered] = useState<
    Array<{ start: number; end: number }>
  >([]);
  const [mediaError, setMediaError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { rate, setPlaybackRate, cycleRate, allowedRates } =
    usePlaybackRate(initialRate);
  useHls(youtubeEmbed ? null : src, videoRef);

  // Every time/progress figure below is relative to the clip window, so a shot
  // reads as its own 8 seconds rather than as an offset into the whole film.
  const clip = useMemo(
    () => parseClipWindow(youtubeEmbed ? null : src),
    [src, youtubeEmbed],
  );
  const clipStart = clip?.start ?? 0;
  const clipEnd = Math.min(clip?.end ?? Infinity, mediaDuration || Infinity);
  const duration = Number.isFinite(clipEnd)
    ? Math.max(0, clipEnd - clipStart)
    : mediaDuration;
  const time = Math.max(0, Math.min(rawTime - clipStart, duration || Infinity));

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing && !optionsOpen) {
      hideTimer.current = setTimeout(() => {
        if (
          !keyboardFocus.current ||
          !containerRef.current?.querySelector("[data-player-controls] :focus")
        )
          setControlsVisible(false);
      }, 2400);
    }
  }, [playing, optionsOpen]);

  useEffect(() => {
    revealControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [revealControls]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (onClose) closeRef.current?.focus({ preventScroll: true });
    else containerRef.current?.focus({ preventScroll: true });
    return () => {
      if (onClose && previous?.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [onClose]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    setSupportsPip(
      !!document.pictureInPictureEnabled &&
        !!videoRef.current?.requestPictureInPicture,
    );
    const update = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);
    const video = videoRef.current;
    const enterPip = () => setPictureInPicture(true);
    const leavePip = () => setPictureInPicture(false);
    video?.addEventListener("enterpictureinpicture", enterPip);
    video?.addEventListener("leavepictureinpicture", leavePip);
    document.addEventListener("fullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      video?.removeEventListener("enterpictureinpicture", enterPip);
      video?.removeEventListener("leavepictureinpicture", leavePip);
      downloadController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!optionsOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!optionsRef.current?.contains(event.target as Node))
        setOptionsOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [optionsOpen]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || mediaError) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    // Replay from the top of the clip instead of resuming on its last frame.
    if (duration && time >= duration - 0.05) {
      video.currentTime = clipStart;
      setRawTime(clipStart);
    }
    void video.play().catch(() => setPlaying(false));
  };
  const seek = (next: number) => {
    if (!videoRef.current || !duration) return;
    const target = clipStart + Math.max(0, Math.min(next, duration));
    videoRef.current.currentTime = target;
    setRawTime(target);
  };
  const changeVolume = (next: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = Math.max(0, Math.min(1, next));
    videoRef.current.muted = next === 0;
    setVolume(videoRef.current.volume);
    setMuted(videoRef.current.muted);
  };
  const toggleMute = () => {
    if (!videoRef.current) return;
    if (videoRef.current.volume === 0) videoRef.current.volume = 0.5;
    videoRef.current.muted = !muted;
    setVolume(videoRef.current.volume);
    setMuted(videoRef.current.muted);
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === containerRef.current)
        await document.exitFullscreen?.();
      else await containerRef.current?.requestFullscreen?.();
    } catch {
      setNotice("Fullscreen is unavailable in this browser.");
    }
  };
  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement === videoRef.current)
        await document.exitPictureInPicture?.();
      else await videoRef.current?.requestPictureInPicture?.();
      setOptionsOpen(false);
    } catch {
      setNotice("Picture in picture is unavailable right now.");
    }
  };
  const updateBuffer = () => {
    const video = videoRef.current;
    if (!video) return;
    setBuffered(
      Array.from({ length: video.buffered.length }, (_, i) => ({
        start: video.buffered.start(i) - clipStart,
        end: video.buffered.end(i) - clipStart,
      })).filter((range) => range.end > 0),
    );
  };
  const download = async () => {
    if (!src || downloading) return;
    setOptionsOpen(false);
    setDownloading(true);
    setNotice(null);
    const controller = new AbortController();
    downloadController.current = controller;
    try {
      const response = await fetch(src, { signal: controller.signal });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        new URL(src, window.location.href).pathname.split("/").pop() ||
        "film.mp4";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Download started.");
    } catch {
      if (!controller.signal.aborted)
        setNotice("Couldn’t download the film. Please try again.");
    } finally {
      if (!controller.signal.aborted) setDownloading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (optionsOpen) {
        setOptionsOpen(false);
        optionsButtonRef.current?.focus();
      } else if (document.fullscreenElement) void document.exitFullscreen?.();
      else onClose?.();
      return;
    }
    if (event.key === "Tab") keyboardFocus.current = true;
    if (event.key === "Tab" && onClose) {
      const controls = Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select, a[href], iframe",
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (
      youtubeEmbed ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      (event.target as HTMLElement).closest(
        "input, select, textarea, button, a, [contenteditable=true]",
      )
    )
      return;
    const actions: Record<string, () => void> = {
      Space: togglePlay,
      ArrowLeft: () => seek(time - 5),
      ArrowRight: () => seek(time + 5),
      ArrowUp: () => changeVolume(volume + 0.05),
      ArrowDown: () => changeVolume(volume - 0.05),
      KeyM: toggleMute,
      KeyF: () => void toggleFullscreen(),
      Comma: () => cycleRate("down"),
      Period: () => cycleRate("up"),
    };
    if (actions[event.code]) {
      event.preventDefault();
      actions[event.code]();
      revealControls();
    }
  };

  const chromeVisible =
    controlsVisible || !playing || optionsOpen || !!mediaError;
  return (
    <div
      ref={containerRef}
      data-film-player
      style={{ "--film-aspect": aspect } as CSSProperties}
      className={`${styles.player} ${onClose ? styles.preview : ""} ${chromeVisible ? "" : styles.idle}`}
      tabIndex={0}
      aria-label={title ? `${title} player` : "Film player"}
      onKeyDown={handleKeyDown}
      onPointerDown={() => {
        keyboardFocus.current = false;
      }}
      onPointerMove={revealControls}
      onFocusCapture={revealControls}
      onBlurCapture={revealControls}
    >
      {(title || onClose) && (
        <header className={styles.header}>
          <span>{title || "Film preview"}</span>
          {onClose && (
            <button
              ref={closeRef}
              className={styles.iconButton}
              onClick={onClose}
              aria-label="Close player"
              title="Close · Esc"
            >
              <X size={18} />
            </button>
          )}
        </header>
      )}
      <div className={styles.stage}>
        {youtubeEmbed ? (
          <iframe
            src={`${youtubeEmbed}${youtubeEmbed.includes("?") ? "&" : "?"}autoplay=${autoplay ? 1 : 0}&rel=0`}
            title={title || "Film"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : src ? (
          <video
            ref={videoRef}
            poster={poster || undefined}
            playsInline
            preload="metadata"
            onClick={() => {
              togglePlay();
              setOptionsOpen(false);
              containerRef.current?.focus({ preventScroll: true });
            }}
            onDoubleClick={() => void toggleFullscreen()}
            onLoadedMetadata={() => {
              const video = videoRef.current!;
              if (video.videoWidth && video.videoHeight)
                setAspect(video.videoWidth / video.videoHeight);
              setMediaDuration(
                Number.isFinite(video.duration) ? video.duration : 0,
              );
              // Not every browser honours the fragment, so open at the window.
              if (clip && video.currentTime < clip.start) {
                video.currentTime = clip.start;
                setRawTime(clip.start);
              }
              if (autoplay)
                void video.play().catch(() => {
                  setPlaying(false);
                  setBuffering(false);
                });
            }}
            onDurationChange={() =>
              setMediaDuration(
                Number.isFinite(videoRef.current?.duration)
                  ? videoRef.current!.duration
                  : 0,
              )
            }
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              // Stop at the end of the window: the file itself runs on.
              if (clip && video.currentTime >= clip.end) {
                video.pause();
                video.currentTime = clip.end;
              }
              setRawTime(video.currentTime);
              updateBuffer();
            }}
            onProgress={updateBuffer}
            onPlay={() => setPlaying(true)}
            onPlaying={() => {
              setPlaying(true);
              setBuffering(false);
            }}
            onPause={() => {
              setPlaying(false);
              setBuffering(false);
            }}
            onEnded={() => {
              setPlaying(false);
              setBuffering(false);
            }}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => setBuffering(false)}
            onVolumeChange={() => {
              setVolume(videoRef.current?.volume ?? 1);
              setMuted(videoRef.current?.muted ?? false);
            }}
            onError={() => {
              setMediaError(true);
              setBuffering(false);
              setPlaying(false);
            }}
          />
        ) : null}
        {(!src || mediaError) && (
          <div className={styles.state} role={mediaError ? "alert" : "status"}>
            <p>Film not available</p>
            <span>
              {src ? "This video couldn’t load." : "No video source provided"}
            </span>
            {src && (
              <button
                onClick={() => {
                  setMediaError(false);
                  setBuffering(true);
                  videoRef.current?.load();
                }}
              >
                <RotateCcw size={13} />
                Try again
              </button>
            )}
          </div>
        )}
        {!youtubeEmbed && src && !mediaError && buffering && (
          <div
            className={styles.buffering}
            role="status"
            aria-label="Buffering film"
          >
            <LoaderCircle size={20} />
          </div>
        )}
        {!youtubeEmbed && src && !mediaError && !playing && !buffering && (
          <button
            className={styles.centerPlay}
            onClick={() => {
              togglePlay();
              containerRef.current?.focus({ preventScroll: true });
            }}
            aria-label="Play video overlay"
          >
            <Play size={20} fill="currentColor" />
          </button>
        )}
      </div>
      {!youtubeEmbed && src && (
        <div className={styles.controls} data-player-controls>
          <div className={styles.timeline}>
            <div className={styles.track}>
              {duration > 0 &&
                buffered.map((range, i) => (
                  <span
                    key={i}
                    className={styles.buffered}
                    style={{
                      left: `${(range.start / duration) * 100}%`,
                      width: `${((range.end - range.start) / duration) * 100}%`,
                    }}
                  />
                ))}
              <span
                className={styles.progress}
                style={{
                  width: `${duration ? Math.min((time / duration) * 100, 100) : 0}%`,
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(time, duration)}
              disabled={!duration || mediaError}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="Video progress"
              aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
            />
          </div>
          <div className={styles.controlRow}>
            <button
              className={styles.iconButton}
              onClick={togglePlay}
              disabled={mediaError}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause · Space" : "Play · Space"}
            >
              {playing ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>
            <span className={styles.time}>
              {formatTime(time)}
              <span>/</span>
              {formatTime(duration)}
            </span>
            <div className={styles.spacer} />
            <div className={styles.volume}>
              <button
                className={styles.iconButton}
                onClick={toggleMute}
                aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                title={muted ? "Unmute · M" : "Mute · M"}
              >
                {muted || volume === 0 ? (
                  <VolumeX size={17} />
                ) : (
                  <Volume2 size={17} />
                )}
              </button>
              <div className={styles.volumePopover}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                  aria-label="Volume"
                />
              </div>
            </div>
            <button
              className={styles.iconButton}
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title="Fullscreen · F"
            >
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <div className={styles.options} ref={optionsRef}>
              <button
                ref={optionsButtonRef}
                className={styles.iconButton}
                onClick={() => setOptionsOpen((open) => !open)}
                aria-label="Playback options"
                title="Playback options"
                aria-expanded={optionsOpen}
                aria-controls="film-playback-options"
              >
                {downloading ? (
                  <LoaderCircle size={17} className={styles.spin} />
                ) : (
                  <MoreHorizontal size={19} />
                )}
              </button>
              {optionsOpen && (
                <div
                  className={styles.optionsPanel}
                  id="film-playback-options"
                  role="group"
                  aria-label="Playback options"
                >
                  <label>
                    Speed
                    <select
                      aria-label="Playback speed"
                      value={rate}
                      onChange={(event) =>
                        setPlaybackRate(Number(event.target.value))
                      }
                    >
                      {allowedRates.map((value) => (
                        <option key={value} value={value}>
                          {value === 1 ? "Normal" : `${value}×`}
                        </option>
                      ))}
                    </select>
                  </label>
                  {supportsPip && (
                    <button onClick={() => void togglePip()}>
                      <PictureInPicture2 size={15} />
                      {pictureInPicture
                        ? "Exit picture in picture"
                        : "Picture in picture"}
                    </button>
                  )}
                  {src.includes(".m3u8") ? (
                    <a href={src} target="_blank" rel="noreferrer">
                      <ExternalLink size={15} />
                      Open stream
                    </a>
                  ) : (
                    <button
                      disabled={downloading}
                      onClick={() => void download()}
                    >
                      <Download size={15} />
                      {downloading ? "Downloading…" : "Download video"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {(notice || downloading) && (
        <div className={styles.notice} role="status">
          {downloading ? (
            <LoaderCircle size={13} className={styles.spin} />
          ) : notice === "Download started." ? (
            <Check size={13} />
          ) : null}
          <span>{downloading ? "Preparing download…" : notice}</span>
          {!downloading && (
            <button
              className={styles.iconButton}
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
