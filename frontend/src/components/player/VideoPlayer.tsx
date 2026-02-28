import { FC, useEffect, useState, useMemo, Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { getStreamUrl, startStream, getStreamStatus, getSubtitleUrl } from "@/api/stream.api";
import type { SubtitleInfo, StreamStatus } from "@/types/api";

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
}

export const VideoPlayer: FC<VideoPlayerProps> = ({ torrentId, movieId, subtitles }) => {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<StreamStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // 1. Kick off the torrent download
    startStream(torrentId).catch(() => {});

    // 2. Poll until the file is identified and ready to stream
    const poll = async () => {
      try {
        const s = await getStreamStatus(torrentId);
        if (!cancelled) {
          setStatus(s);
          if (s.status !== "ready") {
            timer = setTimeout(poll, 2000);
          }
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [torrentId]);

  const token = localStorage.getItem("access_token");
  const streamSrc = `${getStreamUrl(torrentId)}${token ? `?access_token=${token}` : ""}`;

  const defaultLang = useMemo(() => {
    if (!subtitles?.length) return "en";
    const userLang = i18n.language?.split("-")[0] ?? "en";
    if (subtitles.some((s) => s.lang === userLang)) return userLang;
    if (subtitles.some((s) => s.lang === "en")) return "en";
    return subtitles[0].lang;
  }, [i18n.language, subtitles]);

  const isReady = status?.status === "ready";
  const isError = status?.status === "error";
  const isDownloading = status?.status === "downloading";

  // Diagnostic: fetch first subtitle and log content so we can verify the VTT
  useEffect(() => {
    if (!isReady || !subtitles?.length) return;
    const sub = subtitles[0];
    fetch(getSubtitleUrl(movieId, sub.lang))
      .then((r) => r.text())
      .then((text) => {
        const hasCues = /-->/.test(text);
        console.log(`[Subtitle ${sub.lang}] OK=${hasCues} length=${text.length}`, text.slice(0, 300));
      })
      .catch((err) => console.error(`[Subtitle ${sub.lang}] fetch error`, err));
  }, [isReady, movieId, subtitles]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">

      {/* Player — only mounted when the stream is identified and ready */}
      {isReady && (
        <div className="absolute inset-0 [&_.plyr]:h-full [&_.plyr]:w-full [&_video]:h-full [&_video]:w-full">
        <PlyrErrorBoundary>
        <Plyr
          key={torrentId}
          crossOrigin="anonymous"
          source={{
            type: "video",
            title: movieId,
            sources: [{ src: streamSrc, type: "video/mp4" }],
            tracks: (subtitles ?? []).map((sub) => ({
              kind: "subtitles",
              src: getSubtitleUrl(movieId, sub.lang),
              srclang: sub.lang,
              label: sub.label,
              default: sub.lang === defaultLang,
            })),
          }}
          options={{
            controls: [
              "rewind", "play", "fast-forward",
              "progress", "current-time", "duration",
              "mute", "volume", "captions", "pip", "settings", "fullscreen",
            ],
            settings: ["speed", "quality", "captions"],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
            seekTime: 10,
          }}
        />
        </PlyrErrorBoundary>
        </div>
      )}

      {/* Loading overlay */}
      {!isReady && !isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            {isDownloading ? t("downloading") : t("loading")}
          </div>
          {isDownloading && typeof status?.progress === "number" && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-64 bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <span className="text-white/50 text-xs">{status.progress}%</span>
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <span className="text-red-400 text-sm">{t("stream_error")}</span>
        </div>
      )}

    </div>
  );
};
