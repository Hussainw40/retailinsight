import { useState } from 'react';
import { DataPage } from './pages/DataPage';
import { SearchPage } from './pages/SearchPage';

type Tab = 'data' | 'search';

export function App() {
  const [tab, setTab] = useState<Tab>('data');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span> RetailInsight
        </div>
        <nav className="tabs">
          <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>
            Data Explorer
          </button>
          <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>
            AI Search
          </button>
        </nav>
      </header>

      <main className="content">
        {tab === 'data' ? <DataPage /> : <SearchPage />}
      </main>

      <footer className="footer">
        ETL · Microservices · pgvector RAG · Claude
      </footer>
    </div>
  );
}
