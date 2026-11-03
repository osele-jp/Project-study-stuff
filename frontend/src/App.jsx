import { useState } from "react";
import StudyView from "./StudyView";
import { setA, setB } from "./questions";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const SESSION_KEY = "math-research-study-session";

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [started, setStarted] = useState(Boolean(session));
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const setForPhase = (phase) => {
    if (!session) return [];
    const phaseIsFirstSetA = session.set_order === "A_THEN_B" ? phase === 0 : phase === 1;
    return phaseIsFirstSetA ? setA : setB;
  };

  const conditionForPhase = (phase) => {
    if (!session) return null;
    return session.condition_order === "AI_FIRST"
      ? (phase === 0 ? "AI" : "NO_AI")
      : (phase === 0 ? "NO_AI" : "AI");
  };

  const beginStudy = async () => {
    const response = await fetch(`${API_BASE}/api/start`, { method: "POST" });
    if (!response.ok) throw new Error("Could not start the study");
    const data = await response.json();
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    setSession(data);
    setStarted(true);
  };

  const submitQuestion = async (payload) => {
    const response = await fetch(`${API_BASE}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Could not save your answer");

    const questions = setForPhase(phaseIndex);
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1);
    } else if (phaseIndex === 0) {
      setPhaseIndex(1);
      setQuestionIndex(0);
    } else {
      await fetch(`${API_BASE}/api/complete?participant_id=${encodeURIComponent(session.participant_id)}`, {
        method: "POST",
      });
      setCompleted(true);
    }
  };

  if (!started || !session) {
    return (
      <main className="consent-screen">
        <div className="consent-card">
          <h1>Math Research Study</h1>
          <p>
            You will solve six math questions across two phases. One phase permits
            using a Gemini study assistant, while the other does not. Please work independently
            and do not refresh during the study.
          </p>
          <button className="primary" onClick={() => beginStudy().catch((error) => alert(error.message))}>
            Begin Study
          </button>
        </div>
      </main>
    );
  }

  if (completed) {
    const completionCode = `MATH-${session.participant_id.slice(0, 8).toUpperCase()}`;
    return (
      <main className="consent-screen">
        <div className="consent-card completion">
          <h1>Study Complete</h1>
          <p>Thank you for participating.</p>
          <div className="completion-code">{completionCode}</div>
        </div>
      </main>
    );
  }

  const questions = setForPhase(phaseIndex);
  const question = questions[questionIndex];
  const isLastQuestion = phaseIndex === 1 && questionIndex === questions.length - 1;

  return (
    <StudyView
      key={`${phaseIndex}-${question.id}`}
      question={question}
      condition={conditionForPhase(phaseIndex)}
      participantId={session.participant_id}
      onSubmit={submitQuestion}
      nextLabel={isLastQuestion ? "Finish Study" : "Next Question"}
    />
  );
}

export default App;
