import { ArrowRight, Radio, Network, Activity, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          HELMET-MOUNTED TACTICAL MESH COMMUNICATION SYSTEM
        </h1>
        <p className="text-xl text-secondary mb-6 tracking-wide">
          Adaptive communication architecture for NSG close-quarter operations.
        </p>
        <p className="text-gray-400 max-w-3xl mx-auto text-sm leading-relaxed">
          The system models helmet-mounted communication nodes forming a resilient ad-hoc mesh network. 
          Each commando operates as an intelligent network node capable of communicating directly with a 
          gateway or dynamically routing through nearby commandos when direct connectivity deteriorates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <FeatureCard 
          icon={<Network className="text-primary" size={32} />}
          title="ADAPTIVE MESH ROUTING"
          description="Nodes automatically select alternate communication paths when direct gateway connectivity becomes weak."
        />
        <FeatureCard 
          icon={<Radio className="text-secondary" size={32} />}
          title="DIRECTIONAL ANTENNA INTELLIGENCE"
          description="Multiple antenna sectors are evaluated using RSSI to select the strongest communication direction."
        />
        <FeatureCard 
          icon={<Activity className="text-healthy" size={32} />}
          title="REAL-TIME TELEMETRY"
          description="RSSI, PDR, latency, battery level, node connectivity and route changes are monitored continuously."
        />
        <FeatureCard 
          icon={<BrainCircuit className="text-warning" size={32} />}
          title="AI LINK OPTIMIZATION"
          description="An XGBoost model evaluates telemetry to estimate connection quality and assist route selection."
        />
      </div>

      <div className="glass-panel p-8 mb-12">
        <h3 className="text-lg font-bold mb-6 tracking-wider border-b border-white/10 pb-4">SYSTEM ARCHITECTURE</h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-mono text-gray-300">
          <div className="glass-panel p-4 text-center w-full md:w-auto">Helmet Node</div>
          <ArrowRight className="hidden md:block text-primary" />
          <div className="glass-panel p-4 text-center w-full md:w-auto">Directional Antenna Array</div>
          <ArrowRight className="hidden md:block text-primary" />
          <div className="glass-panel p-4 text-center w-full md:w-auto border-primary/50 text-primary">RF Link</div>
          <ArrowRight className="hidden md:block text-primary" />
          <div className="glass-panel p-4 text-center w-full md:w-auto">Mesh Network</div>
          <ArrowRight className="hidden md:block text-primary" />
          <div className="glass-panel p-4 text-center w-full md:w-auto">Gateway</div>
          <ArrowRight className="hidden md:block text-primary" />
          <div className="glass-panel p-4 text-center w-full md:w-auto bg-primary/20 text-white">Mission Dashboard</div>
        </div>
      </div>

      <div className="glass-panel p-6 border-l-4 border-l-warning bg-warning/5">
        <h4 className="font-bold text-warning mb-2">PROTOTYPE SIMULATION CONFIGURATIONS</h4>
        <p className="text-sm text-gray-300">
          Bands being evaluated: 865 MHz and 1.2 GHz. 
          <br/>
          <span className="text-gray-400 italic">Note: These are prototype simulation configurations and do not represent official NSG operating frequencies.</span>
        </p>
      </div>
      
      <div className="mt-12 text-center pb-12">
        <Link to="/simulation" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-8 py-4 rounded-lg font-bold tracking-widest transition-colors">
          LAUNCH SIMULATOR <ArrowRight size={20} />
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-panel p-6 hover:bg-white/5 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold mb-2 tracking-wide">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
