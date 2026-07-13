import { useState } from 'react';
import { api, SearchResult } from '../api';

const EXAMPLES = [
  'What dairy products are on promotion this week?',
  'Cheapest thing to eat at a restaurant right now',
  'Which soft drinks have the biggest discount?',
  'Show me bakery items and their prices',
];

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (q?: string) => {
    const question = (q ?? query).trim();
    if (!question) return;
    setQuery(question);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.search(question));
    } catch (e: any) {
      setError(`Search failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-page">
      <h1>Ask the catalog</h1>
      <p className="muted">
        Natural-language search grounded in the data via pgvector retrieval and Claude.
      </p>

      <div className="search-box">
        <input
          placeholder="e.g. cheapest dairy products on promotion this week"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button onClick={() => run()} disabled={loading}>
          {loading ? 'Thinking…' : 'Search'}
        </button>
      </div>

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => run(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="banner error">{error}</div>}

      {result && (
        <div className="answer-card">
          <div className="answer-text">{result.answer}</div>
          {result.sources.length > 0 && (
            <div className="sources">
              <div className="sources-title">Sources ({result.sources.length})</div>
              {result.sources.map((s, i) => (
                <div key={s.product_id} className="source">
                  <span className="source-num">[{i + 1}]</span>
                  <span>{s.content}</span>
                  <span className="sim">{Math.round(s.similarity * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
