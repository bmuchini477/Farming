import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ZIMBABWE_BOUNDS = [
  [-22.5, 25.2],
  [-15.5, 33.1],
];

const ZIMBABWE_CENTER = [-19.0154, 29.1549];
const MAP_MARKER_ICON = L.icon({
  iconUrl: "/assets/maker.png",
  iconSize: [42, 42],
  iconAnchor: [21, 42],
});

const TILE_LAYERS = {
  normal: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
};

function clampPoint(bounds, lat, lng) {
  const minLat = bounds[0][0];
  const maxLat = bounds[1][0];
  const minLng = bounds[0][1];
  const maxLng = bounds[1][1];

  return {
    lat: Math.min(maxLat, Math.max(minLat, lat)),
    lng: Math.min(maxLng, Math.max(minLng, lng)),
  };
}

function MapClickHandler({ onPick, bounds }) {
  useMapEvents({
    click(event) {
      const picked = clampPoint(bounds, event.latlng.lat, event.latlng.lng);
      onPick(picked);
    },
  });
  return null;
}

function MapResizeHandler({ resizeKey }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [map, resizeKey]);

  return null;
}

export default function ZimbabweMapPicker({
  value,
  onPick,
  center = ZIMBABWE_CENTER,
  maxBounds = ZIMBABWE_BOUNDS,
  initialZoom = 6,
  minZoom = 6,
  maxZoom = 18,
  showFullscreenToggle = true,
}) {
  const mapWrapRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerType, setLayerType] = useState("normal");

  const markerPosition = useMemo(() => {
    if (!value) return null;
    return [value.lat, value.lng];
  }, [value]);
  const activeLayer = TILE_LAYERS[layerType];
  const mapCenter = markerPosition || center;

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === mapWrapRef.current);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!mapWrapRef.current) return;

    if (document.fullscreenElement === mapWrapRef.current) {
      await document.exitFullscreen();
      return;
    }

    await mapWrapRef.current.requestFullscreen();
  }

  return (
    <div ref={mapWrapRef} className={`app-map-wrap ${isFullscreen ? "app-map-wrap-fullscreen" : ""}`}>
      <div className="app-map-toolbar">
        <button
          type="button"
          className="app-map-tool-btn"
          onClick={() => setLayerType((v) => (v === "normal" ? "satellite" : "normal"))}
        >
          {layerType === "normal" ? "Satellite View" : "Normal View"}
        </button>
        {showFullscreenToggle && (
          <button type="button" className="app-map-tool-btn" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        )}
      </div>

      <MapContainer
        center={mapCenter}
        zoom={initialZoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        className="app-map"
      >
        <TileLayer attribution={activeLayer.attribution} url={activeLayer.url} />
        <MapClickHandler onPick={onPick} bounds={maxBounds} />
        <MapResizeHandler resizeKey={`${layerType}-${isFullscreen ? "fs" : "normal"}`} />
        {markerPosition && <Marker position={markerPosition} icon={MAP_MARKER_ICON} />}
      </MapContainer>
    </div>
  );
}
