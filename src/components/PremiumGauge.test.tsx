import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PremiumGauge } from './PremiumGauge';

afterEach(() => cleanup());

describe('PremiumGauge', () => {
  it('renders meter with valuemin -5 / valuemax +5 / valuenow=pct', () => {
    render(<PremiumGauge pctUsd={2.5} tier="warm" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuemin', '-5');
    expect(meter).toHaveAttribute('aria-valuemax', '5');
    expect(meter).toHaveAttribute('aria-valuenow', '2.5');
  });

  it('omits aria-valuenow when pctUsd is null (KRX closed)', () => {
    render(<PremiumGauge pctUsd={null} tier="na" />);
    const meter = screen.getByRole('meter');
    expect(meter).not.toHaveAttribute('aria-valuenow');
    expect(meter).toHaveAttribute('aria-disabled', 'true');
  });

  it('clamps values beyond +5 and shows OVER label', () => {
    render(<PremiumGauge pctUsd={7.8} tier="hot" />);
    expect(screen.getByText('OVER')).toBeInTheDocument();
  });

  it('clamps values beyond -5 and shows OVER label', () => {
    render(<PremiumGauge pctUsd={-12} tier="hot" />);
    expect(screen.getByText('OVER')).toBeInTheDocument();
  });

  it('applies tier class for color (cool/warm/hot/na)', () => {
    const { container, rerender } = render(<PremiumGauge pctUsd={0.5} tier="cool" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-cool');
    rerender(<PremiumGauge pctUsd={2} tier="warm" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-warm');
    rerender(<PremiumGauge pctUsd={4} tier="hot" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-hot');
    rerender(<PremiumGauge pctUsd={null} tier="na" />);
    expect(container.querySelector('.premium-gauge')?.className).toContain('tier-na');
  });
});
