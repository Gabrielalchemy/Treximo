import type { Units } from '../state/settings'

const M_PER_MI = 1609.344

export const distanceLabel = (units: Units) => (units === 'metric' ? 'km' : 'mi')
export const paceUnitLabel = (units: Units) => (units === 'metric' ? '/km' : '/mi')

/** Kilometers → miles for pace values. */
export function paceToDisplaySec(secPerKm: number | null, units: Units): number | null {
  if (secPerKm == null) return null
  return units === 'metric' ? secPerKm : secPerKm * 1.609_344
}

/** Distance in meters → display string in the user's unit. */
export function formatDistance(meters: number, units: Units, decimals = 2): string {
  return units === 'metric'
    ? (meters / 1000).toFixed(decimals)
    : (meters / M_PER_MI).toFixed(decimals)
}

export function splitLengthM(units: Units): number {
  return units === 'metric' ? 1000 : M_PER_MI
}

export function splitLabel(index: number, units: Units): string {
  return units === 'metric' ? `KM ${index}` : `MI ${index}`
}

export function formatRelativeDate(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = d.toDateString() === today.toDateString()
  const sameYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today · ${time}`
  if (sameYesterday) return `Yesterday · ${time}`
  return (
    d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    }) + ` · ${time}`
  )
}
