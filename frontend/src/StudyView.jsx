import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "mathlive";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function MathText({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  );
}

export default function StudyView({ question, condition, participantId, onSubmit, nextLabel }) {
  const fieldRef = useRef(null);
  const startedAt = useRef(Date.now());
  const [answer, setAnswer] = useState("");
  const [tabSwitches, setTabSwitches] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    startedAt.current = Date.now();
    setAnswer("");
    setTabSwitches(0);
    setPasteCount(0);
    setChat([]);
    setChatInput("");
    if (fieldRef.current) {
      fieldRef.current.value = "";
      fieldRef.current.focus();
    }
  }, [question.id]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitches((count) => count + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleNext = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onSubmit({
      participant_id: participantId,
      question_id: question.id,
      condition,
      answer_latex: answer,
      time_spent_ms: Date.now() - startedAt.current,
      tab_switches: tabSwitches,
      paste_count: pasteCount,
    });
    setSubmitting(false);
  };

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    setChatLoading(true);
    const history = [...chat];
    setChat((current) => [...current, { role: "user", message }]);
    setChatInput("");

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          question_id: question.id,
          message,
          history,
        }),
      });
      if (!response.ok) throw new Error("Could not reach the study assistant");
      const data = await response.json();
      setChat((current) => [...current, { role: "assistant", message: data.reply }]);
    } catch (error) {
      setChat((current) => [...current, { role: "assistant", message: `Error: ${error.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className={`study-layout ${condition === "AI" ? "split" : "single"}`}>
      <section className="question-panel">
        <p className="eyebrow">{condition === "AI" ? "AI-Assisted" : "Independent"} condition</p>
        <div className="question">
          <MathText>{question.prompt}</MathText>
        </div>

        <label className="input-label" htmlFor="answer-math">Your answer</label>
        <math-field
          ref={fieldRef}
          id="answer-math"
          virtual-keyboard-mode="onfocus"
          onInput={(event) => setAnswer(event.target.value)}
          onPaste={() => setPasteCount((count) => count + 1)}
          class="math-input"
        />

        <button className="primary" onClick={handleNext} disabled={submitting}>
          {submitting ? "Saving..." : nextLabel}
        </button>
      </section>

      {condition === "AI" && (
        <aside className="chat-panel">
          <h2>Gemini Study Assistant</h2>
          <div className="chat-history" aria-live="polite">
            {chat.length === 0 && <p className="chat-empty">Ask a question about this problem.</p>}
            {chat.map((item, index) => (
              <div key={index} className={`chat-message ${item.role}`}>
                <strong>{item.role === "user" ? "You" : "Assistant"}</strong>
                <MathText>{item.message}</MathText>
              </div>
            ))}
          </div>
          <div className="chat-compose">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendChat();
                }
              }}
              placeholder="Ask for a hint..."
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
