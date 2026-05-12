import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HelpPanel } from './HelpPanel';

afterEach(() => cleanup());

describe('HelpPanel', () => {
  it('renders summary text and is closed by default', () => {
    render(<HelpPanel />);
    expect(screen.getByText(/도움말/)).toBeInTheDocument();
    const details = screen.getByTestId('help-panel') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('opens when summary clicked + reveals 4 sections', () => {
    render(<HelpPanel />);
    const details = screen.getByTestId('help-panel') as HTMLDetailsElement;
    const summary = details.querySelector('summary')!;
    // happy-dom 에서 details.open 토글은 click 으로 simulate
    fireEvent.click(summary);
    // 4 섹션 헤더 확인 (innerText 직접 접근)
    expect(screen.getByText(/가격 변동/)).toBeInTheDocument();
    expect(screen.getByText(/프리미엄 단계/)).toBeInTheDocument();
    expect(screen.getByText(/신호 단계/)).toBeInTheDocument();
    expect(screen.getByText(/거래소 약어/)).toBeInTheDocument();
  });
});
