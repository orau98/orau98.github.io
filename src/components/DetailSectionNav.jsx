export default function DetailSectionNav({ items = [], label = 'Sections' }) {
  const visibleItems = items.filter((item) => item?.id && item?.label);
  if (!visibleItems.length) return null;

  const handleClick = (event, id) => {
    event.preventDefault();
    const candidates = [
      document.getElementById(id),
      ...document.querySelectorAll(`[data-section-id="${id}"]`),
    ].filter(Boolean);
    const target = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }) || candidates[0];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
    } catch {}
  };

  return (
    <nav
      aria-label={label}
      className="sticky top-[calc(var(--app-main-header-height,0px)+8px)] z-30 mb-6 overflow-x-auto rounded-xl border border-slate-200/70 bg-white/85 px-2 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80"
    >
      <div className="flex min-w-max items-center gap-1">
        {visibleItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => handleClick(event, item.id)}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
