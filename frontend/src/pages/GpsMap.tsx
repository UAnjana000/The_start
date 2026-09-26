import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Map as MapIcon, Layers } from 'lucide-react';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const center: [number, number] = [12.9716, 77.5946];

const mockNodes = [
  { id: 'Gateway', pos: [12.9716, 77.5946], status: 'ACTIVE', isGw: true },
  { id: 'Node A', pos: [12.9720, 77.5950], status: 'ACTIVE' },
  { id: 'Node B', pos: [12.9710, 77.5940], status: 'ACTIVE' },
  { id: 'Node C', pos: [12.9730, 77.5960], status: 'DEGRADED' },
];

export default function GpsMap() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-panel z-10">
        <div className="flex items-center gap-3">
          <MapIcon className="text-secondary" size={24} />
          <h1 className="text-xl font-bold tracking-widest">GPS TRACKING</h1>
        </div>
        <div className="flex gap-4 text-xs font-mono font-bold">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> GATEWAY</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> ACTIVE</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> DEGRADED</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> INACTIVE</div>
        </div>
      </div>
      
      <div className="flex-1 relative z-0">
        <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%', background: '#050A12' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {mockNodes.map((node, i) => (
            <Marker key={i} position={node.pos as [number, number]}>
              <Popup className="custom-popup">
                <div className="font-mono font-bold">{node.id}</div>
                <div className="text-xs text-gray-500">{node.status}</div>
              </Popup>
            </Marker>
          ))}

          <Polyline positions={[mockNodes[1].pos as [number, number], mockNodes[0].pos as [number, number]]} color="#00E5FF" weight={3} />
          <Polyline positions={[mockNodes[2].pos as [number, number], mockNodes[0].pos as [number, number]]} color="#00E5FF" weight={3} />
          <Polyline positions={[mockNodes[3].pos as [number, number], mockNodes[1].pos as [number, number]]} color="#FFC400" weight={2} dashArray="5, 5" />
        </MapContainer>
      </div>
    </div>
  );
}
