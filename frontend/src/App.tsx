import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import VideoFeed from './pages/VideoFeed';
import LiveSimulation from './pages/LiveSimulation';
import NodeAnalytics from './pages/NodeAnalytics';
import MissionHistory from './pages/MissionHistory';
import GpsMap from './pages/GpsMap';
import AiAnalytics from './pages/AiAnalytics';
import SystemStatus from './pages/SystemStatus';
import Analysis from './pages/Analysis';

function App() {
  return (
    <Router>
      <div className="min-h-screen grid-bg flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/video" element={<VideoFeed />} />
            <Route path="/simulation" element={<LiveSimulation />} />
            <Route path="/analytics" element={<NodeAnalytics />} />
            <Route path="/history" element={<MissionHistory />} />
            <Route path="/map" element={<GpsMap />} />
            <Route path="/ai" element={<AiAnalytics />} />
            <Route path="/status" element={<SystemStatus />} />
            <Route path="/analysis" element={<Analysis />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
