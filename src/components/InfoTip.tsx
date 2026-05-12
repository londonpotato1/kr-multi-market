import { useState } from 'react';

type Props = { term: string; description: string; ariaLabel?: string };

export function InfoTip({ term, description, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span className="info-tip-wrap">
      <button
        type="button"
        className="info-tip"
        title={description}
        aria-label={ariaLabel ?? `${term}: ${description}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
      >
        ⓘ
      </button>
      {open && (
        <span className="info-tip-popover" role="tooltip">
          <strong>{term}</strong>: {description}
        </span>
      )}
    </span>
  );
}
