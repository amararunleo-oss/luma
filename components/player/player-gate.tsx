export function PlayerGate({ embedUrl, title, aspectRatio }: { embedUrl: string; title: string; aspectRatio?: number }) {
  const ratio = Number(aspectRatio);
  const safeRatio = Number.isFinite(ratio) && ratio >= 1 && ratio <= 3 ? ratio : 16 / 9;
  return (
    <div className="player-frame" style={{ aspectRatio: safeRatio }}>
      <div className="player-embed-crop">
        <iframe
          src={embedUrl}
          title={title}
          loading="eager"
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
