import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import type { Station } from '@/types/weather';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
  className: 'selected-marker',
});

interface StationMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station) => void;
}

// Component to recenter map when selection changes
function MapController({ selectedStation }: { selectedStation: Station | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedStation) {
      map.flyTo([selectedStation.latitude, selectedStation.longitude], 13, {
        duration: 0.5,
      });
    }
  }, [selectedStation, map]);

  return null;
}

// Barcelona center coordinates
const BARCELONA_CENTER: LatLngExpression = [41.3851, 2.1734];

export function StationMap({ stations, selectedStation, onSelectStation }: StationMapProps) {
  return (
    <div className="h-48 rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={BARCELONA_CENTER}
        zoom={11}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController selectedStation={selectedStation} />
        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={selectedStation?.id === station.id ? selectedIcon : defaultIcon}
            eventHandlers={{
              click: () => onSelectStation(station),
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{station.name}</p>
                <p className="text-muted-foreground">
                  {station.distance} km · {station.elevation ?? '—'} m
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
