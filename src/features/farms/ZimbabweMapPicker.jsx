import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
      // We still clamp points to Zimbabwe when picking a farm location, 
      // but the map itself can move freely.
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

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function ZimbabweMapPicker({
  value,
  onPick,
  center = ZIMBABWE_CENTER,
  maxBounds = ZIMBABWE_BOUNDS,
  initialZoom = 6,
  minZoom = 3, // Reduced minZoom for more flexibility
  maxZoom = 18,
  showFullscreenToggle = true,
}) {
  const mapWrapRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerType, setLayerType] = useState("normal");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

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

  const fetchSuggestions = useCallback(async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setIsLoadingSearch(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=zw&limit=5`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        fetchSuggestions(searchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchSuggestions]);

  const handleSelectSuggestion = (suggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    onPick({ lat, lng: lon });
    setSearchQuery(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={mapWrapRef} className={`app-map-wrap ${isFullscreen ? "app-map-wrap-fullscreen" : ""}`}>
      <div className="app-map-toolbar">
        <div className="app-map-search-container">
          <input
            type="text"
            className="app-map-search-input"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="app-map-suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="app-map-suggestion-item"
                  onClick={() => handleSelectSuggestion(s)}
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
          {isLoadingSearch && <div className="app-map-search-loader" />}
        </div>

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
        // Removed maxBounds constraints to move freely
        className="app-map"
      >
        <TileLayer attribution={activeLayer.attribution} url={activeLayer.url} />
        <ChangeView center={mapCenter} />
        <MapClickHandler onPick={onPick} bounds={maxBounds} />
        <MapResizeHandler resizeKey={`${layerType}-${isFullscreen ? "fs" : "normal"}`} />
        {markerPosition && <Marker position={markerPosition} icon={MAP_MARKER_ICON} />}
      </MapContainer>
    </div>
  );
}
