import { ArrowRight, Radio, Network, Activity, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto h-full overflow-y-auto space-y-10">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent leading-tight">
          HELMET-MOUNTED TACTICAL MESH COMMUNICATION SYSTEM
        </h1>
        <p className="text-xl md:text-2xl text-secondary tracking-wide font-bold">
          Adaptive C4ISR Mesh Communication Architecture for Close-Quarter Operations
        </p>
        <p className="text-gray-200 max-w-4xl mx-auto text-base md:text-lg leading-relaxed font-medium">
          The system models helmet-mounted communication nodes forming a resilient ad-hoc mesh network. 
          Each operator acts as an intelligent relay node capable of communicating directly with the command gateway 
          or dynamically routing packets through neighboring squad members under severe electronic or architectural line-of-sight obstruction.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FeatureCard 
          icon={<Network className="text-primary w-10 h-10" />}
          title="ADAPTIVE MESH ROUTING"
          description="Nodes continuously evaluate link quality and automatically discover multi-hop alternate paths when direct line-of-sight is blocked by reinforced concrete."
        />
        <FeatureCard 
          icon={<Radio className="text-secondary w-10 h-10" />}
          title="DUAL-ANTENNA DIVERSITY"
          description="Hardware RF multiplexing switches between front and rear hemispherical antenna sectors based on live RSSI delta to maximize gain."
        />
        <FeatureCard 
          icon={<Activity className="text-healthy w-10 h-10" />}
          title="REAL-TIME TELEMETRY STREAM"
          description="Sub-second transmission of RSSI, PDR, latency, battery levels, acoustic SPL, and dynamic topology changes directly to C2 command."
        />
        <FeatureCard 
          icon={<BrainCircuit className="text-warning w-10 h-10" />}
          title="EDGE XGBOOST AI PREDICTOR"
          description="Embedded Machine Learning estimates connection degradation 15-30s in advance, enabling proactive route failovers before connection dropouts."
        />
      </div>

      <div className="glass-panel p-8 shadow-xl border border-white/15">
        <h3 className="text-xl font-black mb-6 tracking-wider border-b border-white/10 pb-4 text-white uppercase">
          HARDWARE &amp; NETWORK ARCHITECTURE PIPELINE
        </h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-base font-mono font-bold text-gray-200">
          <div className="glass-panel px-5 py-3.5 text-center w-full md:w-auto bg-slate-900 border-white/20">Helmet Edge Node</div>
          <ArrowRight className="hidden md:block text-primary w-6 h-6 shrink-0" />
          <div className="glass-panel px-5 py-3.5 text-center w-full md:w-auto bg-slate-900 border-white/20">Dual-Antenna Array</div>
          <ArrowRight className="hidden md:block text-primary w-6 h-6 shrink-0" />
          <div className="glass-panel px-5 py-3.5 text-center w-full md:w-auto border-primary/50 text-primary bg-primary/10">RF Mesh Link</div>
          <ArrowRight className="hidden md:block text-primary w-6 h-6 shrink-0" />
          <div className="glass-panel px-5 py-3.5 text-center w-full md:w-auto bg-slate-900 border-white/20">Ad-Hoc Network</div>
          <ArrowRight className="hidden md:block text-primary w-6 h-6 shrink-0" />
          <div className="glass-panel px-5 py-3.5 text-center w-full md:w-auto bg-slate-900 border-white/20">C2 Gateway</div>
          <ArrowRight className="hidden md:block text-primary w-6 h-6 shrink-0" />
          <div className="glass-panel px-5 py-3.5 text-center w-full md:w-auto bg-primary/25 text-white border-primary">Live Dashboard</div>
        </div>
      </div>

      <div className="glass-panel p-6 border-l-4 border-l-warning bg-warning/10 shadow-lg">
        <h4 className="font-extrabold text-lg text-warning mb-2">PROTOTYPE SIMULATION RF SPECIFICATIONS</h4>
        <p className="text-base text-gray-200 font-medium">
          Evaluated Frequencies: <strong>865 MHz ISM</strong> and <strong>1.2 GHz Tactical Relay</strong> bands with AES-128 cryptographic telemetry envelopes.
        </p>
      </div>
      
      <div className="text-center pb-8">
        <Link to="/simulation" className="inline-flex items-center gap-3 bg-primary hover:bg-primary/80 text-slate-950 px-10 py-5 rounded-2xl font-black text-xl tracking-widest transition-all shadow-xl shadow-primary/20">
          LAUNCH LIVE TACTICAL SIMULATOR <ArrowRight size={24} />
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-panel p-7 hover:bg-white/10 transition-colors shadow-lg border border-white/15">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-black mb-2.5 tracking-wide text-white">{title}</h3>
      <p className="text-gray-300 text-base leading-relaxed font-medium">{description}</p>
    </div>
  );
}
