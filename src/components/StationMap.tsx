import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Station } from '@/types/weather';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
});

interface StationMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station) => void;
}

// Barcelona center coordinates
const BARCELONA_CENTER: L.LatLngExpression = [41.3851, 2.1734];

export function StationMap({ stations, selectedStation, onSelectStation }: StationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: BARCELONA_CENTER,
      zoom: 11,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when stations change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Add new markers
    stations.forEach(station => {
      const marker = L.marker([station.latitude, station.longitude], {
        icon: selectedStation?.id === station.id ? selectedIcon : defaultIcon,
      })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="font-size: 14px;">
            <p style="font-weight: 600; margin: 0;">${station.name}</p>
            <p style="color: #666; margin: 4px 0 0 0; font-size: 12px;">
              ${station.distance} km · ${station.elevation ?? '—'} m
            </p>
          </div>
        `)
        .on('click', () => onSelectStation(station));

      markersRef.current.set(station.id, marker);
    });
  }, [stations, selectedStation, onSelectStation]);

  // Fly to selected station
  useEffect(() => {
    if (!mapRef.current || !selectedStation) return;

    mapRef.current.flyTo([selectedStation.latitude, selectedStation.longitude], 13, {
      duration: 0.5,
    });

    // Update marker icon
    markersRef.current.forEach((marker, id) => {
      marker.setIcon(id === selectedStation.id ? selectedIcon : defaultIcon);
    });
  }, [selectedStation]);

  return (
    <div 
      ref={containerRef} 
      className="h-48 rounded-lg overflow-hidden border border-border"
      style={{ zIndex: 0 }}
    />
  );
}
