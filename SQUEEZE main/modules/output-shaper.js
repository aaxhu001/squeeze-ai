/**
 * SQUEEZE - Output Shaper
 * Output Token Reduction & Effort Steering engine.
 * Cuts expensive model output tokens by steering verbosity and clamping reasoning effort on routine turns.
 */

class OutputShaper {
  /**
   * Steer system instructions for output token reduction.
   * @param {string} systemPrompt - Existing system prompt
   * @param {object} options - Options
   * @returns {string} Optimized system prompt
   */
  static steerSystemPrompt(systemPrompt = '', options = {}) {
    const opts = {
      level: 'terse', // 'terse' | 'minimal' | 'standard'
      ...options
    };

    if (opts.level === 'standard') return systemPrompt;

    const terseDirective = `\n\n[SQUEEZE Output Optimization: Be highly concise. Omit restating code or context unless requested. Avoid decorative preambles.]`;

    if (!systemPrompt || systemPrompt.trim() === '') {
      return terseDirective.trim();
    }

    // Append to end so Anthropic / OpenAI prefix cache hits remain intact
    return systemPrompt + terseDirective;
  }

  /**
   * Shape model reasoning effort / budget based on turn context.
   * @param {object} payload - OpenAI or Anthropic payload object
   * @param {object} options - Options
   * @returns {object} Modified payload with clamped effort
   */
  static shapeEffort(payload, options = {}) {
    if (!payload || typeof payload !== 'object') return payload;

    const opts = {
      enableEffortClamping: true,
      routineEffortLevel: 'low', // 'low' | 'medium' | 'minimal'
      routineThinkingBudget: 1024,
      ...options
    };

    if (!opts.enableEffortClamping) return payload;

    const isRoutineTurn = this._detectRoutineTurn(payload);

    if (isRoutineTurn) {
      // OpenAI reasoning effort
      if ('reasoning_effort' in payload || payload.model?.includes('o1') || payload.model?.includes('o3')) {
        payload.reasoning_effort = opts.routineEffortLevel;
      }

      // Anthropic thinking budget
      if (payload.thinking && typeof payload.thinking === 'object') {
        payload.thinking.budget_tokens = Math.min(payload.thinking.budget_tokens || 2048, opts.routineThinkingBudget);
      }
    }

    return payload;
  }

  static _detectRoutineTurn(payload) {
    const messages = payload.messages || [];
    if (messages.length === 0) return false;

    const lastMsg = messages[messages.length - 1];
    
    // If the last message is a tool output, file read, or standard confirmation
    if (lastMsg.role === 'tool' || lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
      const content = String(lastMsg.content).toLowerCase();
      if (content.includes('tool_result') || content.includes('success') || content.includes('file contents') || content.length < 150) {
        // If it doesn't contain explicit error stack traces
        if (!content.includes('error') && !content.includes('fatal') && !content.includes('exception')) {
          return true;
        }
      }
    }
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OutputShaper;
}
if (typeof window !== 'undefined') {
  window.OutputShaper = OutputShaper;
}
