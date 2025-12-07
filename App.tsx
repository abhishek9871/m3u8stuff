import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './src/components/layout/AppLayout';
import HomePage from './src/components/pages/HomePage';
import DetailPage from './src/components/pages/DetailPage';
import PlayerPage from './src/components/pages/PlayerPage';
import SearchPage from './src/components/pages/SearchPage';
import WatchlistPage from './src/components/pages/WatchlistPage';
import { WatchlistProvider } from './src/context/WatchlistContext';

const App: React.FC = () => {
  return (
    <WatchlistProvider>
      <HashRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/:type/:id" element={<DetailPage />} />
            <Route path="/play/:type/:id" element={<PlayerPage />} />
          </Routes>
        </AppLayout>
      </HashRouter>
    </WatchlistProvider>
  );
};

export default App;