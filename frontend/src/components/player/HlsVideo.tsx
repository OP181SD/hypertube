import { FC, useEffect, useRef } from "react";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

export interface HlsTrack {
  src: string;
  srclang: string;
  label: string;
  default: boolean;
}

interface HlsVideoProps {
  src: string;
  tracks: HlsTrack[];
  options: Plyr.Options;
}

export const HlsVideo: FC<HlsVideoProps> = ({ src, tracks, options }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackKey = tracks.map((t) => `${t.srclang}:${t.src}`).join("|");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    let player: Plyr | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ startPosition: 0 });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        player = new Plyr(video, options);
        video.currentTime = 0;
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      player = new Plyr(video, options);
    }

    return () => {
      try {
        player?.destroy();
      } catch {
        /* already destroyed */
      }
      hls?.destroy();
    };
  }, [src, options, trackKey]);

  return (
    <video ref={videoRef} playsInline className="h-full w-full">
      {tracks.map((track) => (
        <track
          key={track.srclang}
          kind="subtitles"
          src={track.src}
          srcLang={track.srclang}
          label={track.label}
          default={track.default}
        />
      ))}
    </video>
  );
};
