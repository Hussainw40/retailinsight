import { useEffect, useState } from 'react';
import { api, Product, Stats } from '../api';

const CATEGORIES = ['', 'grocery', 'restaurant', 'product'];

export function DataPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, p] = await Promise.all([
        api.stats(),
        api.products({ category: category || undefined, search: search || undefined }),
      ]);
      setStats(s);
      setProducts(p);
    } catch (e: any) {
      setError(`Could not reach the API. Is the stack up and has the ETL run? (${e.message})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <div>
      {stats && (
        <div className="stat-grid">
          <Stat label="Merchants" value={stats.merchants} />
          <Stat label="Products" value={stats.products} />
          <Stat label="Promotions" value={stats.promotions} />
          <Stat label="Embedded (RAG)" value={stats.embedded} />
          <Stat label="Grocery" value={stats.grocery} />
          <Stat label="Restaurant" value={stats.restaurant} />
        </div>
      )}

      <div className="toolbar">
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button
              key={c || 'all'}
              className={`chip ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c || 'all'}
            </button>
          ))}
        </div>
        <div className="search-inline">
          <input
            placeholder="Filter by name or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button onClick={load}>Filter</button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {loading && <div className="banner">Loading…</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Merchant</th>
              <th>Price</th>
              <th>Promotion</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  {p.brand && <span className="muted"> · {p.brand}</span>}
                </td>
                <td>
                  <span className="tag">{p.category}</span>
                  {p.subcategory && <span className="muted"> {p.subcategory}</span>}
                </td>
                <td>
                  {p.merchant} {p.city && <span className="muted">· {p.city}</span>}
                </td>
                <td>{p.price != null ? `${p.currency ?? '$'} ${p.price}` : '—'}</td>
                <td>
                  {p.promotion ? (
                    <span className="promo">
                      {p.promotion}
                      {p.discount_pct ? ` (−${p.discount_pct}%)` : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={5} className="muted center">
                  No products. Run the ETL: <code>curl -X POST http://localhost:3001/etl/run</code>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? 0}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
