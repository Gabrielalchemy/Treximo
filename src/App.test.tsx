// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { db } from './db/db'

describe('App smoke', () => {
  it('renders the record screen by default', () => {
    render(<App />)
    expect(screen.getByText('TREXIMO')).toBeTruthy()
    expect(screen.getByText('Time')).toBeTruthy()
    expect(screen.getByText('Distance')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start run' })).toBeTruthy()
  })

  it('navigates to history and shows the empty state', async () => {
    window.location.hash = '#/history'
    render(<App />)

    // Wait for Dexie query + AnimatePresence exit transition.
    expect(
      await screen.findByText('No runs yet', {}, { timeout: 5000 }),
    ).toBeTruthy()

    window.location.hash = ''
  })

  it('renders a completed run detail with route and splits', async () => {
    const id = 'test-run-1'
    const base = Date.UTC(2026, 7, 1, 6)
    const points = Array.from({ length: 101 }, (_, i) => ({
      lat: (i * 10) / ((6371008.8 * Math.PI) / 180),
      lng: 0,
      t: base + i * 1000,
      acc: 4,
    }))
    await db.runs.add({
      id,
      status: 'completed',
      startedAt: base,
      endedAt: base + 100_000,
      distanceM: 1000,
      movingMs: 100_000,
      points,
    })

    window.location.hash = `#/run/${id}`
    render(<App />)

    expect(
      await screen.findByText('KM 1', {}, { timeout: 5000 }),
    ).toBeTruthy()
    expect(screen.getAllByText('Splits').length).toBeGreaterThan(0)
    // Hero distance unit (metric); pace label may also contain it.
    expect(screen.getAllByText('km').length).toBeGreaterThan(0)

    await db.runs.delete(id)
    window.location.hash = ''
  })
})
