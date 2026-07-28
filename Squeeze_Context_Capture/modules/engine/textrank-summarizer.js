/**
 * Squeeze Context Capture — TextRank & TF-IDF Extractive Summarization Engine
 * 100% Local, Pure JavaScript, Zero ML models, Zero API calls.
 */

(function(exports) {
  "use strict";

  // English Stopwords for TF-IDF Vectorization
  const STOPWORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "can't", "cannot",
    "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few",
    "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll",
    "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most",
    "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
    "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
    "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom",
    "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
    "yours", "yourself", "yourselves", "also", "just", "like", "using", "use", "make", "sure", "see", "get", "need",
    "want", "know", "think", "please", "thanks", "hello", "hi", "hey"
  ]);

  // Tokenize string into sentences
  function tokenizeSentences(text) {
    if (!text) return [];
    // Split by sentence ending punctuation followed by space or newline
    const raw = text.split(/(?<=[.!?])\s+|\n+/g);
    const sentences = [];
    raw.forEach(s => {
      const trimmed = s.trim();
      // Keep sentences that are at least 15 chars and contain words
      if (trimmed.length >= 15 && /[a-zA-Z]{3,}/.test(trimmed)) {
        sentences.push(trimmed);
      }
    });
    return sentences;
  }

  // Tokenize text into words & stems
  function tokenizeWords(text) {
    if (!text) return [];
    const clean = text.toLowerCase().replace(/[^a-z0-9_\-\s]/g, " ");
    const words = clean.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
    return words;
  }

  // Extract Technical Terms and Entities
  function extractKeyTerms(text, topN = 10) {
    if (!text) return [];
    const termFreq = new Map();

    // Match camelCase, snake_case, uppercase tech terms, or filenames
    const techRegex = /\b[A-Za-z0-9_]{3,}(?:\.[a-z]{2,4}|[A-Z][a-z]+|_|\-)?\b/g;
    const matches = text.match(techRegex) || [];

    matches.forEach(m => {
      const lower = m.toLowerCase();
      if (STOPWORDS.has(lower) || lower.length < 3 || /^\d+$/.test(lower)) return;
      termFreq.set(m, (termFreq.get(m) || 0) + 1);
    });

    const sorted = Array.from(termFreq.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, topN).map(pair => pair[0]);
  }

  // Compute TF-IDF Vectors for sentences
  function buildTFIDFVectors(sentences) {
    const docCount = sentences.length;
    const tfList = [];
    const dfMap = new Map();
    const vocab = new Set();

    sentences.forEach((sent, idx) => {
      const words = tokenizeWords(sent);
      const tf = new Map();
      const uniqueWordsInSent = new Set(words);

      words.forEach(w => {
        tf.set(w, (tf.get(w) || 0) + 1);
        vocab.add(w);
      });

      // Normalize TF by sentence length
      const len = words.length || 1;
      for (const [w, count] of tf.entries()) {
        tf.set(w, count / len);
      }

      uniqueWordsInSent.forEach(w => {
        dfMap.set(w, (dfMap.get(w) || 0) + 1);
      });

      tfList.push(tf);
    });

    // Compute IDF
    const idfMap = new Map();
    vocab.forEach(w => {
      const df = dfMap.get(w) || 1;
      const idf = Math.log((1 + docCount) / (1 + df)) + 1.0;
      idfMap.set(w, idf);
    });

    // Compute final TF-IDF vectors
    const vectors = tfList.map(tf => {
      const vec = new Map();
      for (const [w, tfVal] of tf.entries()) {
        vec.set(w, tfVal * (idfMap.get(w) || 1.0));
      }
      return vec;
    });

    return { vectors, vocab: Array.from(vocab) };
  }

  // Cosine Similarity between two sparse vectors
  function cosineSimilarity(vecA, vecB) {
    if (vecA.size === 0 || vecB.size === 0) return 0.0;

    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (const [w, valA] of vecA.entries()) {
      normA += valA * valA;
      if (vecB.has(w)) {
        dotProduct += valA * vecB.get(w);
      }
    }

    for (const valB of vecB.values()) {
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0.0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // PageRank algorithm over similarity matrix
  function runPageRank(similarityMatrix, recencyWeights, dampingFactor = 0.85, maxIter = 40) {
    const N = similarityMatrix.length;
    if (N === 0) return [];
    if (N === 1) return [1.0];

    let scores = new Array(N).fill(1.0 / N);

    // Sum of outgoing weights for each node
    const outDegrees = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i !== j) outDegrees[i] += similarityMatrix[i][j];
      }
    }

    for (let iter = 0; iter < maxIter; iter++) {
      const nextScores = new Array(N).fill(0);
      let diff = 0.0;

      for (let i = 0; i < N; i++) {
        let rankSum = 0.0;
        for (let j = 0; j < N; j++) {
          if (i !== j && outDegrees[j] > 0) {
            rankSum += (similarityMatrix[j][i] / outDegrees[j]) * scores[j];
          }
        }
        // Incorporate recency bias into tele-port probability
        const baseProb = (1.0 - dampingFactor) * (recencyWeights[i] || (1.0 / N));
        nextScores[i] = baseProb + dampingFactor * rankSum;
        diff += Math.abs(nextScores[i] - scores[i]);
      }

      scores = nextScores;
      if (diff < 1e-5) break; // Convergence reached
    }

    return scores;
  }

  // Leader-follower clustering to group sentences by topic
  function clusterSentences(sentences, vectors, k = 4) {
    if (sentences.length <= k) {
      return sentences.map((s, idx) => ({ clusterId: idx, sentence: s, vecIndex: idx }));
    }

    const clusters = [];
    const targetClusters = Math.min(k, sentences.length);

    sentences.forEach((s, idx) => {
      const vec = vectors[idx];
      let bestCluster = -1;
      let bestSim = 0.25; // Similarity threshold for clustering

      clusters.forEach((c, cIdx) => {
        const sim = cosineSimilarity(vec, c.centroid);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = cIdx;
        }
      });

      if (bestCluster >= 0 && clusters.length >= targetClusters) {
        clusters[bestCluster].items.push({ sentence: s, vecIndex: idx });
      } else if (clusters.length < targetClusters) {
        clusters.push({
          centroid: vec,
          items: [{ sentence: s, vecIndex: idx }]
        });
      } else {
        // Default to first cluster if none exceeded threshold
        clusters[0].items.push({ sentence: s, vecIndex: idx });
      }
    });

    return clusters;
  }

  // Main Context Capture Pipeline Entry Point
  function summarizeTurns(turns, options = {}) {
    if (!turns || turns.length === 0) {
      return {
        summary: "No conversation turns found to summarize.",
        tokenEst: 0,
        rulesApplied: []
      };
    }

    // 1. Extract all sentences with turn metadata (recency, sender)
    const sentenceItems = [];
    const totalTurns = turns.length;

    turns.forEach((turn, turnIdx) => {
      const recencyWeight = 0.8 + 0.6 * ((turnIdx + 1) / totalTurns); // Recency bias (1.4x for latest turns)
      const sentences = tokenizeSentences(turn.text);

      sentences.forEach(s => {
        sentenceItems.push({
          text: s,
          sender: turn.sender,
          turnIdx: turnIdx,
          recencyWeight: recencyWeight
        });
      });
    });

    if (sentenceItems.length === 0) {
      return {
        summary: "No readable sentence context found in conversation.",
        tokenEst: 0,
        rulesApplied: []
      };
    }

    // 2. Build TF-IDF Vectors
    const sentencesText = sentenceItems.map(item => item.text);
    const { vectors } = buildTFIDFVectors(sentencesText);

    // 3. Build Cosine Similarity Matrix
    const N = sentencesText.length;
    const similarityMatrix = Array.from({ length: N }, () => new Array(N).fill(0));

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const sim = cosineSimilarity(vectors[i], vectors[j]);
        if (sim >= 0.05) { // Filter noise
          similarityMatrix[i][j] = sim;
          similarityMatrix[j][i] = sim;
        }
      }
    }

    // 4. Run PageRank with Recency Weights
    const recencyNormalized = sentenceItems.map(item => item.recencyWeight);
    const recencySum = recencyNormalized.reduce((a, b) => a + b, 0) || 1;
    const recencyProbs = recencyNormalized.map(w => w / recencySum);

    const pageRankScores = runPageRank(similarityMatrix, recencyProbs);

    // Attach scores to sentence items
    sentenceItems.forEach((item, idx) => {
      item.score = pageRankScores[idx] || 0;
    });

    // 5. Topic Clustering & Representative Selection
    const maxClusters = Math.min(5, Math.max(2, Math.floor(N / 3)));
    const clusters = clusterSentences(sentencesText, vectors, maxClusters);

    const selectedSentences = [];
    clusters.forEach(cluster => {
      // Pick highest PageRank sentence in cluster
      let topItem = null;
      let topScore = -1;

      cluster.items.forEach(cItem => {
        const original = sentenceItems[cItem.vecIndex];
        if (original && original.score > topScore) {
          topScore = original.score;
          topItem = original;
        }
      });

      if (topItem && !selectedSentences.includes(topItem)) {
        selectedSentences.push(topItem);
      }
    });

    // Sort selected sentences chronologically by turn index
    selectedSentences.sort((a, b) => a.turnIdx - b.turnIdx);

    // 6. Extract Key Terms & Code Blocks
    const fullText = turns.map(t => t.text).join(" ");
    const keyTerms = extractKeyTerms(fullText, 8);

    const latestCodeByLanguage = {};
    turns.forEach(t => {
      if (t.codeBlocks && Array.isArray(t.codeBlocks)) {
        t.codeBlocks.forEach(cb => {
          if (cb.code && cb.code.trim().length > 10) {
            latestCodeByLanguage[cb.language || "code"] = cb.code.trim();
          }
        });
      }
    });

    // 7. Format Output Context Capsule
    let capsule = `## Context Transfer Capsule (Extractive TextRank)\n\n`;
    capsule += `> Synthesized from ${totalTurns} conversation turns using local TF-IDF + PageRank topic graph. 100% Offline.\n\n`;

    if (selectedSentences.length > 0) {
      capsule += `### 🎯 Extractive Topic Thesis\n`;
      selectedSentences.forEach(s => {
        capsule += `- ${s.text}\n`;
      });
      capsule += `\n`;
    }

    if (keyTerms.length > 0) {
      capsule += `### 🔑 Key Technical Terms & Entities\n`;
      capsule += keyTerms.map(t => `\`${t}\``).join(", ") + `\n\n`;
    }

    if (Object.keys(latestCodeByLanguage).length > 0) {
      capsule += `### 💻 Latest Code State\n`;
      for (const [lang, code] of Object.entries(latestCodeByLanguage)) {
        let displayCode = code;
        if (displayCode.length > 2500) {
          displayCode = displayCode.substring(0, 2500) + "\n// ... [Code state trimmed for token efficiency]";
        }
        capsule += `\`\`\`${lang}\n${displayCode}\n\`\`\`\n\n`;
      }
    }

    capsule += `*Paste this capsule into a new chat to continue with full context. Generated by Squeeze TextRank Engine.*`;

    return {
      summary: capsule,
      tokenEst: Math.round(capsule.length / 4),
      rulesApplied: ["TextRank Graph PageRank", "TF-IDF Recency Weighting", "Topic Clustering"]
    };
  }

  // Export engine methods
  exports.TextRankSummarizer = {
    summarizeTurns,
    tokenizeSentences,
    tokenizeWords,
    buildTFIDFVectors,
    cosineSimilarity,
    runPageRank,
    extractKeyTerms
  };

})(typeof exports !== "undefined" ? exports : window);
