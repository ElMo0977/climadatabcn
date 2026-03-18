import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Station } from '@/types/weather';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

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

interface StationMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station) => void;
}

// Barcelona center coordinates
const BARCELONA_CENTER: L.LatLngExpression = [41.3851, 2.1734];
const POPUP_PADDING_TOP_LEFT = L.point(12, 52);
const POPUP_PADDING_BOTTOM_RIGHT = L.point(12, 12);

export function StationMap({ stations, selectedStation, onSelectStation }: StationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedStationIdRef = useRef<string | null>(null);

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
        existingMarker.getPopup()?.setContent(buildStationPopup(station));
        return;
      }

      const marker = L.marker([station.latitude, station.longitude], {
        icon: defaultIcon,
      })
        .addTo(map)
        .bindPopup(buildStationPopup(station), {
          autoPan: true,
          autoPanPaddingTopLeft: POPUP_PADDING_TOP_LEFT,
          autoPanPaddingBottomRight: POPUP_PADDING_BOTTOM_RIGHT,
          keepInView: true,
        })
        .on('click', () => onSelectStation(station));

      markersRef.current.set(station.id, marker);
    });

    syncMarkerSelection(markersRef.current, selectedStationIdRef.current);
  }, [stations, onSelectStation]);

  // Fly to selected station
  useEffect(() => {
    selectedStationIdRef.current = selectedStation?.id ?? null;
    syncMarkerSelection(markersRef.current, selectedStationIdRef.current);
    if (!mapRef.current) return;
    if (!selectedStation) {
      mapRef.current.closePopup();
      return;
    }

    const map = mapRef.current;
    const selectedMarker = markersRef.current.get(selectedStation.id);
    const reopenPopup = () => selectedMarker?.openPopup();

    selectedMarker?.openPopup();
    map.flyTo([selectedStation.latitude, selectedStation.longitude], 13, {
      duration: 0.5,
    });
    map.once('moveend', reopenPopup);

    return () => {
      map.off('moveend', reopenPopup);
    };
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

function buildStationPopup(station: Station): string {
  return `
    <div style="font-size: 14px;">
      <p style="font-weight: 600; margin: 0;">${station.name}</p>
      <p style="color: #666; margin: 4px 0 0 0; font-size: 12px;">
        ${station.distance} km · ${station.elevation ?? '—'} m
      </p>
    </div>
  `;
}
