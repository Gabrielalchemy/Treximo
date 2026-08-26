/** Whether the environment exposes the Web Speech synthesis API. */
export function supportsSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Speak a phrase via the Web Speech API. Utterances queue behind pending
 * ones (no cancel), so multi-part coach announcements play in order.
 * Best-effort: silently no-ops where unsupported or blocked.
 */
export function speak(text: string): void {
  if (!supportsSpeech()) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    window.speechSynthesis.speak(u)
  } catch {
    /* speech is best-effort */
  }
}
