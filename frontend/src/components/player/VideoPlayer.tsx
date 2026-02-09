import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

  if (!status || status.status === "idle") {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (status.status === "downloading") {
    return (
      <div className="w-full aspect-video bg-black flex flex-col items-center justify-center rounded-lg gap-4">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          {t("downloading")}
        </div>
        <div className="w-64 bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <span className="text-white/50 text-xs">{status.progress}%</span>
      </div>
    );
  }

  if (status.status === "error") {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg">
        <span className="text-red-400 text-sm">{t("stream_error")}</span>
      </div>
    );
  }

  const token = localStorage.getItem("access_token");
  const streamSrc = `${getStreamUrl(torrentId)}${token ? `?access_token=${token}` : ""}`;

  return (
    <video
      data-testid="video-player"
      className="w-full aspect-video bg-black rounded-lg"
      controls
      autoPlay
      src={streamSrc}
    >
      {subtitles.map((sub) => (
        <track
          key={sub.lang}
          kind="subtitles"
          src={getSubtitleUrl(movieId, sub.lang)}
          srcLang={sub.lang}
          label={sub.label}
        />
      ))}
    </video>
  );
};
