import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { Station, ReferencePoint } from '@/types/weather';

// Fix for default marker icons
const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
});

const referenceIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 22.5 12.5 41 12.5 41C12.5 41 25 22.5 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="#ef4444" stroke="white" stroke-width="2"/>
    <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.85"/>
  </svg>`,
  className: '',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface StationMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station) => void;
  referencePoint?: ReferencePoint | null;
}

// Barcelona center coordinates
const BARCELONA_CENTER: L.LatLngExpression = [41.3851, 2.1734];

export function StationMap({ stations, selectedStation, onSelectStation, referencePoint }: StationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedStationIdRef = useRef<string | null>(null);
  const referenceMarkerRef = useRef<L.Marker | null>(null);
  const referencePointRef = useRef<ReferencePoint | null>(referencePoint ?? null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: BARCELONA_CENTER,
      zoom: 11,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markers = markersRef.current;

    return () => {
      if (mapRef.current === map) {
        map.remove();
        mapRef.current = null;
      }
      markers.clear();
    };
  }, []);

  // Update markers when stations change
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const nextStationIds = new Set(stations.map((station) => station.id));

    markersRef.current.forEach((marker, stationId) => {
      if (!nextStationIds.has(stationId)) {
        marker.remove();
        markersRef.current.delete(stationId);
      }
    });

    stations.forEach((station) => {
      const existingMarker = markersRef.current.get(station.id);
      if (existingMarker) {
        existingMarker.setLatLng([station.latitude, station.longitude]);
        existingMarker.off('click').on('click', () => onSelectStation(station));
        return;
      }

      const marker = L.marker([station.latitude, station.longitude], {
        icon: defaultIcon,
      })
        .addTo(map)
        .on('click', () => onSelectStation(station));

      markersRef.current.set(station.id, marker);
    });

    syncMarkerSelection(markersRef.current, selectedStationIdRef.current);
  }, [stations, onSelectStation]);

  // Update reference point marker
  useEffect(() => {
    referencePointRef.current = referencePoint ?? null;
    const map = mapRef.current;
    if (!map) return;

    if (referenceMarkerRef.current) {
      referenceMarkerRef.current.remove();
      referenceMarkerRef.current = null;
    }

    if (!referencePoint) return;

    referenceMarkerRef.current = L.marker(
      [referencePoint.lat, referencePoint.lon],
      { icon: referenceIcon, zIndexOffset: 1000 },
    )
      .addTo(map)
      .bindPopup(
        `<div style="font-size:13px;"><strong>📍 ${referencePoint.label}</strong></div>`,
      );

    // If a station is already selected, re-fit bounds to include the new reference point
    const selectedId = selectedStationIdRef.current;
    const selectedMarker = selectedId ? markersRef.current.get(selectedId) : null;
    if (selectedMarker) {
      const stationLatLng = selectedMarker.getLatLng();
      const bounds = L.latLngBounds(stationLatLng, [referencePoint.lat, referencePoint.lon]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true, duration: 0.5 });
    }
  }, [referencePoint]);

  // Fly to selected station
  useEffect(() => {
    selectedStationIdRef.current = selectedStation?.id ?? null;
    syncMarkerSelection(markersRef.current, selectedStationIdRef.current);
    if (!mapRef.current) return;
    if (!selectedStation) return;

    const map = mapRef.current;

    const refPt = referencePointRef.current;
    if (refPt) {
      const bounds = L.latLngBounds(
        [selectedStation.latitude, selectedStation.longitude],
        [refPt.lat, refPt.lon],
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true, duration: 0.5 });
    } else {
      map.flyTo([selectedStation.latitude, selectedStation.longitude], 13, { duration: 0.5 });
    }
  }, [selectedStation]);

  return (
    <div 
      ref={containerRef} 
      className="h-56 rounded-lg overflow-hidden border border-border md:h-60"
      style={{ zIndex: 0 }}
    />
  );
}

function syncMarkerSelection(markers: Map<string, L.Marker>, selectedStationId: string | null): void {
  markers.forEach((marker, id) => {
    marker.setIcon(id === selectedStationId ? selectedIcon : defaultIcon);
  });
}

