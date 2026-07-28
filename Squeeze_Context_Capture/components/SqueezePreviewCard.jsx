// components/SqueezePreviewCard.jsx
import React, { useState } from 'react';

function SqueezePreviewCard({ summary, tokensSaved, sessionId, summaryId }) {
  const [continuing, setContinuing] = useState(false);

  async function handleContinue() {
    setContinuing(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/squeeze/continue`, {
        method: 'POST'
      });
      const { newSessionId } = await res.json();
      // navigate to new session, seed it with bootstrapMessage + carriedForwardMessages
      window.location.href = `/chat/${newSessionId}`;
    } catch (err) {
      console.error("Failed to continue in new chat:", err);
      setContinuing(false);
    }
  }

  const decisions = Array.isArray(summary?.decisions) ? summary.decisions : [];
  const openThreads = Array.isArray(summary?.open_threads) ? summary.open_threads : [];

  return (
    <div className="squeeze-preview">
      <h3>Chat squeezed — {(tokensSaved || 0).toLocaleString()} tokens saved</h3>

      {summary?.goal && (
        <div className="summary-section">
          <strong>Goal:</strong> <p>{summary.goal}</p>
        </div>
      )}

      {decisions.length > 0 && (
        <div className="summary-section">
          <strong>Decisions made:</strong>
          <ul>{decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}

      {summary?.current_state && (
        <div className="summary-section">
          <strong>Current state:</strong> <p>{summary.current_state}</p>
        </div>
      )}

      {openThreads.length > 0 && (
        <div className="summary-section">
          <strong>Open threads:</strong>
          <ul>{openThreads.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      <button onClick={handleContinue} disabled={continuing} className="continue-btn">
        {continuing ? "Opening New Chat..." : "Continue in new chat"}
      </button>
    </div>
  );
}

export default SqueezePreviewCard;
