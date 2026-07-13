// Same-origin paths: nginx (prod) and Vite (dev) both proxy these to the
// api-service (/api) and ai-search-service (/ai).

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  merchant?: string;
  merchant_type?: string;
  city?: string;
  price?: number;
  currency?: string;
  promotion?: string;
  discount_pct?: number;
}

export interface Stats {
  merchants: number;
  products: number;
  promotions: number;
  embedded: number;
  grocery: number;
  restaurant: number;
}

export interface SearchSource {
  product_id: string;
  content: string;
  similarity: number;
  [key: string]: any;
}

export interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  stats: () => getJSON<Stats>('/api/stats'),

  products: (params: { category?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    return getJSON<Product[]>(`/api/products?${q.toString()}`);
  },

  search: async (query: string): Promise<SearchResult> => {
    const res = await fetch('/ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
};
