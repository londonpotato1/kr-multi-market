import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    cleanup();
  });

  test('initial theme is system when no localStorage value', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('System')).toBeTruthy();
  });

  test('localStorage value light is restored and applied to <html>', () => {
    localStorage.setItem('kr-mm:theme', 'light');
    render(<ThemeToggle />);
    expect(screen.getByText('Light')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('invalid localStorage value falls back to system (no cast)', () => {
    localStorage.setItem('kr-mm:theme', 'rainbow-glitter');
    render(<ThemeToggle />);
    expect(screen.getByText('System')).toBeTruthy();
  });

  test('cycle: dark → light → system → dark', () => {
    localStorage.setItem('kr-mm:theme', 'dark');
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(screen.getByText('Dark')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText('Light')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText('System')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  test('writing system removes localStorage entry', () => {
    localStorage.setItem('kr-mm:theme', 'dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('kr-mm:theme')).toBe('light');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('kr-mm:theme')).toBeNull();
  });

  test('private browsing simulation: setItem throws → no crash', () => {
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => render(<ThemeToggle />)).not.toThrow();
    Storage.prototype.setItem = origSet;
  });
});

describe('ThemeToggle keyboard shortcut "t"', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    cleanup();
  });

  test('plain "t" cycles theme (system → dark, given no mq match)', () => {
    render(<ThemeToggle />);
    // initial = system (matchMedia returns false in happy-dom by default → resolves to dark)
    fireEvent.keyDown(document, { key: 't' });
    // system → dark
    expect(localStorage.getItem('kr-mm:theme')).toBe('dark');
  });

  test('ignores "t" when focus is on <input>', () => {
    localStorage.setItem('kr-mm:theme', 'dark');
    render(
      <>
        <ThemeToggle />
        <input data-testid="text" />
      </>
    );
    const input = screen.getByTestId('text') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 't' });
    expect(localStorage.getItem('kr-mm:theme')).toBe('dark');
  });

  test('ignores "t" when focus is on <textarea>', () => {
    localStorage.setItem('kr-mm:theme', 'dark');
    render(
      <>
        <ThemeToggle />
        <textarea data-testid="ta" />
      </>
    );
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    fireEvent.keyDown(ta, { key: 't' });
    expect(localStorage.getItem('kr-mm:theme')).toBe('dark');
  });

  test('ignores "t" when focus is on [contenteditable]', () => {
    localStorage.setItem('kr-mm:theme', 'dark');
    render(
      <>
        <ThemeToggle />
        <div data-testid="ce" contentEditable />
      </>
    );
    const ce = screen.getByTestId('ce') as HTMLDivElement;
    ce.focus();
    fireEvent.keyDown(ce, { key: 't' });
    expect(localStorage.getItem('kr-mm:theme')).toBe('dark');
  });

  test('ignores Ctrl+t / Meta+t / Alt+t (modifier combos)', () => {
    localStorage.setItem('kr-mm:theme', 'dark');
    render(<ThemeToggle />);
    fireEvent.keyDown(document, { key: 't', ctrlKey: true });
    fireEvent.keyDown(document, { key: 't', metaKey: true });
    fireEvent.keyDown(document, { key: 't', altKey: true });
    expect(localStorage.getItem('kr-mm:theme')).toBe('dark');
  });
});
