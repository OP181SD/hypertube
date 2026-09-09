import { FC, useEffect, useState, useMemo, useRef, Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plyr } from "plyr-react";
import type PlyrTypes from "plyr";
import "plyr-react/plyr.css";
import { getStreamUrl, getHlsUrl, getStreamStatus, getSubtitleUrl, getSubtitles } from "@/api/stream.api";
import type { SubtitleInfo, StreamStatus } from "@/types/api";
import { HlsVideo } from "./HlsVideo";

const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";

function usePlayerFocus(enabled: boolean) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = wrapRef.current;
    if (!root) return;

    const plyrEl = () => root.querySelector<HTMLElement>(".plyr");

    const makeFocusable = () => {
      const el = plyrEl();
      if (el && el.tabIndex < 0) el.tabIndex = 0;
    };

    const observer = new MutationObserver(makeFocusable);
    observer.observe(root, { childList: true, subtree: true });
    makeFocusable();

    const onPointerDown = () => {
      makeFocusable();
      plyrEl()?.focus({ preventScroll: true });
    };
    root.addEventListener("pointerdown", onPointerDown);

    return () => {
      observer.disconnect();
      root.removeEventListener("pointerdown", onPointerDown);
    };
  }, [enabled]);

  return wrapRef;
}

class PlyrErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3 p-4">
          <span className="text-red-400 text-sm font-mono">Plyr crash :</span>
          <span className="text-white/60 text-xs font-mono text-center break-all">
            {(this.state.error as Error).message}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

interface VideoPlayerProps {
  torrentId: string;
  movieId: string;
  subtitles: SubtitleInfo[];
  season?: number | null;
  episode?: number | null;
}

export const VideoPlayer: FC<VideoPlayerProps> = ({
  torrentId,
  movieId,
  subtitles,
  season,
  episode,
}) => {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const episodeKey = useMemo(
    () =>
      season != null && episode != null ? { season, episode } : undefined,
    [season, episode],
  );
  const [episodeSubtitles, setEpisodeSubtitles] = useState<SubtitleInfo[] | null>(
    episodeKey ? null : subtitles,
  );

  const [polledTorrentId, setPolledTorrentId] = useState(torrentId);
  if (torrentId !== polledTorrentId) {
    setPolledTorrentId(torrentId);
    setStatus(null);
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const s = await getStreamStatus(torrentId);
        if (cancelled) return;
        setStatus(s);
        if (s.status !== "ready" && s.status !== "error") {
          timer = setTimeout(poll, 500);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 1500);
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [torrentId, movieId]);

  useEffect(() => {
    if (!episodeKey) {
      setEpisodeSubtitles(subtitles);
      return;
    }
    let cancelled = false;
    setEpisodeSubtitles(null);
    getSubtitles(movieId, episodeKey)
      .then((list) => {
        if (!cancelled) setEpisodeSubtitles(list);
      })
      .catch(() => {
        if (!cancelled) setEpisodeSubtitles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId, season, episode, subtitles]);

  const activeSubtitles = episodeSubtitles ?? [];

  const streamSrc = getStreamUrl(torrentId);

  const defaultLang = useMemo(() => {
    if (!activeSubtitles.length) return "en";
    const userLang = i18n.language?.split("-")[0] ?? "en";
    if (activeSubtitles.some((s) => s.lang === userLang)) return userLang;
    if (activeSubtitles.some((s) => s.lang === "en")) return "en";
    return activeSubtitles[0].lang;
  }, [i18n.language, activeSubtitles]);

  const playerOptions = useMemo<PlyrTypes.Options>(
    () => ({
      // Avoid cdn.plyr.io blank.mp4 (ACAO *) which breaks credentialed playback.
      blankVideo: "/blank.mp4",
      controls: [
        "rewind", "play", "fast-forward",
        "progress", "current-time", "duration",
        "mute", "volume", "captions", "pip", "settings", "fullscreen",
      ],
      settings: ["speed", "quality", "captions"],
      captions: { active: false, language: "auto", update: true },
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
      seekTime: 10,
      keyboard: { focused: true, global: false },
    }),
    [],
  );

  const subtitleTracks = useMemo(
    () =>
      activeSubtitles.map((sub) => ({
        src: getSubtitleUrl(movieId, sub.lang, episodeKey),
        srclang: sub.lang,
        label: sub.label,
        default: sub.lang === defaultLang,
      })),
    [activeSubtitles, movieId, defaultLang, episodeKey],
  );

  const isReady = status?.status === "ready";
  const isError = status?.status === "error";
  const isSearching = status?.status === "searching";
  const isDownloading = status?.status === "downloading";
  const isConverting = status?.status === "converting";
  const isHls = status?.mimeType === HLS_MIME_TYPE;
  const subsReady = episodeKey == null || episodeSubtitles !== null;
  const wrapRef = usePlayerFocus(Boolean(isReady && subsReady));
  const dbg = status?.debug;
  const prefixPct =
    dbg?.prefixNeed && dbg.prefixNeed > 0
      ? Math.min(100, Math.round(((dbg.prefixHave ?? 0) / dbg.prefixNeed) * 100))
      : typeof status?.progress === "number"
        ? status.progress
        : 0;

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">

      {isReady && subsReady && (
        <div
          ref={wrapRef}
          className="absolute inset-0 [&_.plyr]:h-full [&_.plyr]:w-full [&_video]:h-full [&_video]:w-full"
        >
        <PlyrErrorBoundary>
        {isHls ? (
          <HlsVideo
            key={torrentId}
            src={getHlsUrl(torrentId)}
            tracks={subtitleTracks}
            options={playerOptions}
          />
        ) : (
        <Plyr
          key={torrentId}
          source={{
            type: "video",
            title: movieId,
            sources: [{ src: streamSrc, type: status?.mimeType ?? "video/mp4" }],
            tracks: subtitleTracks.map((track) => ({ kind: "subtitles", ...track })),
          }}
          options={playerOptions}
        />
        )}
        </PlyrErrorBoundary>
        </div>
      )}

      {(!isReady || !subsReady) && !isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            {isSearching
              ? t("searching_sources")
              : isConverting
                ? t("converting")
                : isDownloading
                  ? t("downloading")
                  : t("loading")}
          </div>
          {!isSearching && (
          <div className="w-full max-w-md bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${prefixPct}%` }}
            />
          </div>
          )}
        </div>
      )}

      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black px-6">
          <span className="text-red-400 text-sm text-center">
            {status?.error === "no_sources" ? t("stream_unavailable") : t("stream_error")}
          </span>
        </div>
      )}

    </div>
  );
};
