"use client";

import { useEffect, useState } from "react";

const WORDS = [
  "experienced",
  "principled",
  "meticulous",
  "discerning",
  "considered",
  "inspired",
  "experiential",
  "refined",
];

const LETTER_STAGGER_MS = 55;
const LETTER_FADE_MS = 400;
const HOLD_MS = 1500;
const EXIT_MS = 500;

export function RotatingWord({ paused = false }: { paused?: boolean }) {
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  const word = WORDS[index];

  useEffect(() => {
    if (paused) {
      setExiting(false);
      return;
    }
    const typeMs = word.length * LETTER_STAGGER_MS + LETTER_FADE_MS;
    const exitTimer = setTimeout(() => setExiting(true), typeMs + HOLD_MS);
    const nextTimer = setTimeout(() => {
      setExiting(false);
      setIndex((i) => (i + 1) % WORDS.length);
    }, typeMs + HOLD_MS + EXIT_MS);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(nextTimer);
    };
  }, [word, paused]);

  return (
    <span key={word} className={`inline-block ${exiting ? "word-out" : ""}`}>
      {word.split("").map((letter, i) => (
        <span
          key={i}
          className="letter-in inline-block"
          style={{ animationDelay: `${i * LETTER_STAGGER_MS}ms` }}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}
