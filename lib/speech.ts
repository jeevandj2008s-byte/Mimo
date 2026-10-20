export function appendSpeechText(existing: string, transcript: string): string {
  const next = transcript.trim();
  if (!next) return existing;
  const current = existing.trim();
  return current ? `${current} ${next}` : next;
}

export function getSpeechRecognition(): SpeechRecognitionConstructorLike | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}
