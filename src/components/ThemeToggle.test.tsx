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
