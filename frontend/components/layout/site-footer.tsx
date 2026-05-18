export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 py-10">
      <p className="text-center text-sm tracking-wide text-zinc-500">
        Made with{" "}
        <span className="text-rose-400/80" aria-label="love">
          &hearts;
        </span>{" "}
        by{" "}
        <a
          href="https://sc0rp10n.space"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 underline-offset-4 transition hover:text-cyan-300 hover:underline"
        >
          sc0rp10n
        </a>
      </p>
    </footer>
  );
}
