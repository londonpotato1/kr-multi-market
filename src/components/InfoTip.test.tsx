import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InfoTip } from './InfoTip';

afterEach(() => cleanup());

describe('InfoTip', () => {
  it('renders button with ⓘ glyph and aria-label', () => {
    render(<InfoTip term="프리미엄" description="KRX vs HL 가격 차이 (%)" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', '프리미엄: KRX vs HL 가격 차이 (%)');
    expect(btn).toHaveAttribute('title', 'KRX vs HL 가격 차이 (%)');
    expect(btn.textContent).toBe('ⓘ');
  });

  it('popover hidden by default, aria-expanded=false', () => {
    render(<InfoTip term="X" description="Y" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('click opens popover, second click closes', () => {
    render(<InfoTip term="프리미엄" description="설명 텍스트" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip').textContent).toContain('프리미엄');
    expect(screen.getByRole('tooltip').textContent).toContain('설명 텍스트');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('blur closes popover', () => {
    render(<InfoTip term="X" description="Y" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('uses custom ariaLabel when provided', () => {
    render(<InfoTip term="X" description="Y" ariaLabel="Custom ARIA" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Custom ARIA');
  });
});
