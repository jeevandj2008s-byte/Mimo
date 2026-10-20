"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { appendSpeechText, getSpeechRecognition } from "@/lib/speech";

type SpeechInputButtonProps = {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  label?: string;
};

export function SpeechInputButton({ onTranscript, disabled = false, label = "Dictate" }: SpeechInputButtonProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    recorderRef.current?.stop();
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopMicrophone = () => {
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
  };

  const toggle = async () => {
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      setListening(false);
      stopMicrophone();
      return;
    }
    const Constructor = getSpeechRecognition();
    if (!Constructor) {
      await startRecorderFallback();
      return;
    }
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        microphoneStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setStatus(name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access and try again." : "Mimo could not access your microphone.");
        return;
      }
    }
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length - event.resultIndex }, (_, index) => {
        const result = event.results[event.resultIndex + index];
        return result?.[0]?.transcript ?? "";
      }).join(" ");
      if (transcript.trim()) onTranscript(transcript);
      setStatus("Voice note captured. You can edit it before saving.");
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "Microphone permission was denied. Allow microphone access and try again.",
        "audio-capture": "No microphone was found. Check your device settings.",
        "no-speech": "Mimo did not hear speech. Try again when you are ready.",
        network: "Voice transcription could not connect. Check your connection.",
        "service-not-allowed": "Voice transcription is blocked by the browser. Allow microphone and speech access for localhost.",
      };
      setStatus(messages[event.error] ?? "Voice transcription failed. Please try again.");
      setListening(false);
      stopMicrophone();
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      stopMicrophone();
    };
    recognition.onstart = () => setStatus("Speak now — Mimo is listening...");
    recognitionRef.current = recognition;
    setStatus(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      stopMicrophone();
      setStatus("Mimo could not start the microphone. Please try again.");
    }
  };

  const startRecorderFallback = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("Voice input is not supported here. Try Chrome or Edge on localhost.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onerror = () => { setListening(false); stopMicrophone(); setStatus("Mimo could not record your microphone."); };
      recorder.onstop = async () => {
        recorderRef.current = null;
        stopMicrophone();
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const extension = (recorder.mimeType || "").includes("mp4") ? "mp3" : "webm";
        setStatus("Transcribing your recording...");
        try {
          const formData = new FormData();
          formData.append("file", new File([blob], `mimo-voice.${extension}`, { type: blob.type || "audio/webm" }));
          const response = await fetch("/api/transcribe", { method: "POST", body: formData });
          const result = await response.json() as { transcript?: unknown; error?: unknown };
          if (!response.ok || typeof result.transcript !== "string") throw new Error(typeof result.error === "string" ? result.error : "Voice transcription failed.");
          onTranscript(result.transcript);
          setStatus("Voice note captured. You can edit it before submitting.");
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Voice transcription failed. Please try again.");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("Recording... click Voice again to stop.");
      setListening(true);
    } catch (error) {
      stopMicrophone();
      setStatus(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied. Allow access and try again." : "Mimo could not access your microphone.");
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        aria-label={listening ? "Stop voice input" : label}
        aria-pressed={listening}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold transition ${listening ? "bg-[#fff0f4] text-[#bd6c8d]" : "bg-[#f5f1ff] text-[#7354c7] hover:bg-[#e8e0ff]"}`}
        disabled={disabled}
        onClick={toggle}
        type="button"
      >
        {listening ? <MicOff size={14} /> : <Mic size={14} />}
        {listening ? "Listening..." : label}
      </button>
      {status ? <span aria-live="polite" className="max-w-[220px] text-[10px] font-semibold leading-4 text-[#bd6c8d]">{status}</span> : null}
    </span>
  );
}

export function mergeSpeechText(existing: string, transcript: string): string {
  return appendSpeechText(existing, transcript);
}
