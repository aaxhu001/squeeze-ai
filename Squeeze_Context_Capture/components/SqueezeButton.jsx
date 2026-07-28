// components/SqueezeButton.jsx
import React, { useState } from 'react';

function SqueezeButton({ sessionId, onSqueezeComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSqueeze() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/squeeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 429) {
          setError(data.message || 'Squeeze quota reached. Upgrade your plan to continue.');
        } else {
          setError(data.message || 'Squeeze failed. Please try again.');
        }
        return;
      }

      const result = await res.json();
      if (onSqueezeComplete) {
        onSqueezeComplete(result); // parent shows the preview card
      }
    } catch (err) {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="squeeze-btn-wrapper">
      <button 
        onClick={handleSqueeze} 
        disabled={loading}
        className="squeeze-chat-btn"
      >
        {loading ? 'Squeezing...' : 'Squeeze this chat'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default SqueezeButton;
