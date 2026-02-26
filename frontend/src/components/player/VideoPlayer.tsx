import { FC, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { getStreamUrl, getStreamStatus, getSubtitleUrl } from "@/api/stream.api";
import type { SubtitleInfo, StreamStatus } from "@/types/api";

interface VideoPlayerProps {
  torrentId: string;
  movieId: string;
  subtitles: SubtitleInfo[];
}

export const VideoPlayer: FC<VideoPlayerProps> = ({
  torrentId,
  movieId,
  subtitles,
}) => {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<StreamStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

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
        if (!cancelled) {
          timer = setTimeout(poll, 3000);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [torrentId]);

  const defaultLang = useMemo(() => {
    const userLang = i18n.language?.split("-")[0] || "en";
    if (subtitles.some((s) => s.lang === userLang)) return userLang;
    if (subtitles.some((s) => s.lang === "en")) return "en";
    return subtitles[0]?.lang;
  }, [i18n.language, subtitles]);

  const token = localStorage.getItem("access_token");
  const streamSrc = `${getStreamUrl(torrentId)}${token ? `?access_token=${token}` : ""}`;

  const isLoading = !status || status.status === "idle" || (status.status === "downloading" && status.progress < 1);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <Plyr
        key={torrentId}
        source={{
          type: "video",
          title: movieId,
          sources: [
            { src: streamSrc, type: "video/mp4" },
          ],
          tracks: subtitles.map((sub) => ({
            kind: "subtitles",
            src: getSubtitleUrl(movieId, sub.lang),
            srclang: sub.lang,
            label: sub.label,
            default: sub.lang === defaultLang,
          })),
        }}
        options={{
          controls: [
            "rewind",
            "play",
            "fast-forward",
            "progress",
            "current-time",
            "duration",
            "mute",
            "volume",
            "captions",
            "pip",
            "settings",
            "fullscreen",
          ],
          settings: ["quality", "captions"],
          seekTime: 10,
        }}
      />

      {isLoading && status?.status !== "error" && (
        <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            {status?.status === "downloading" ? t("downloading") : t("loading")}
          </div>
          {status?.status === "downloading" && (
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

      {status?.status === "error" && (
        <div className="absolute inset-0 z-10 bg-black flex items-center justify-center">
          <span className="text-red-400 text-sm">{t("stream_error")}</span>
        </div>
      )}
    </div>
  );
};