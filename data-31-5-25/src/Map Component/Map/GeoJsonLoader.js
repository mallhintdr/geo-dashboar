import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { handleMurabbaClick } from "./geoJsonTransform";
import { bindMurabbaTooltip } from "./bindTooltips";
import "./GeoJsonLoader.css";

const GeoJsonLoader = ({ geoJsonUrl, mustateelLayers, setMurabbaOptions, onMurabbaSelect, setBoundsFit }) => {
  const map = useMap();
  const geoJsonLayerRef = useRef(null);
  const previousUrlRef = useRef(null); // Store the last processed GeoJSON URL

  useEffect(() => {
    const loadGeoJsonLayer = async () => {
      // Avoid reloading if the URL hasn't changed
      if (geoJsonUrl === previousUrlRef.current) {
        return;
      }

      // Update URL reference
      previousUrlRef.current = geoJsonUrl;

      try {
        // Cleanup previous layers
        mustateelLayers.current.forEach((layer) => map.removeLayer(layer));
        mustateelLayers.current = [];

        if (geoJsonLayerRef.current) {
          map.removeLayer(geoJsonLayerRef.current);
        }

        // Validate geoJsonUrl
        if (!geoJsonUrl) {
          setMurabbaOptions([]);
          return;
        }

        // Fetch GeoJSON data
        const response = await fetch(geoJsonUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoJSON: ${response.statusText}`);
        }

        const geoJsonData = await response.json();

        // Validate GeoJSON features
        if (!geoJsonData.features || geoJsonData.features.length === 0) {
          setMurabbaOptions([]);
          return;
        }

        // Extract and sort Murabba_No
        const murabbaNumbers = geoJsonData.features
          .filter((feature) => feature.properties?.Murabba_No)
          .map((feature) => feature.properties.Murabba_No)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        setMurabbaOptions(murabbaNumbers);

        // Create and add GeoJSON layer
        const newGeoJsonLayer = L.geoJSON(geoJsonData, {
          onEachFeature: (feature, layer) => {
            if (feature.properties?.Murabba_No) {
              bindMurabbaTooltip(feature, layer, map);

              layer.on("click", () => {
                handleMurabbaClick(feature, map, mustateelLayers);
              });

              layer.on("programmaticSelect", () => {
                handleMurabbaClick(feature, map, mustateelLayers);
              });
            }
          },
          style: {
            fillColor: "#000000",
            fillOpacity: 0,
            color: "#ff0c04",
            weight: 3,
          },
        });

        newGeoJsonLayer.addTo(map);
        geoJsonLayerRef.current = newGeoJsonLayer;

        // Fit bounds to the layer
        const bounds = newGeoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds);
          setBoundsFit(true); // Notify MapComponent that bounds were fit
        } else {
          console.warn("Invalid bounds for GeoJSON layer.");
        }
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
      }
    };

    loadGeoJsonLayer();

    return () => {
      // Cleanup on component unmount or URL change
      mustateelLayers.current.forEach((layer) => map.removeLayer(layer));
      mustateelLayers.current = [];
      if (geoJsonLayerRef.current) {
        map.removeLayer(geoJsonLayerRef.current);
      }
    };
  }, [geoJsonUrl, map, mustateelLayers, setMurabbaOptions, setBoundsFit]);

  // Handle programmatic selection of Murabba
  useEffect(() => {
    if (onMurabbaSelect && geoJsonLayerRef.current) {
      const selectedMurabbaFeature = geoJsonLayerRef.current.toGeoJSON().features.find(
        (feature) => feature.properties?.Murabba_No === onMurabbaSelect
      );

      if (selectedMurabbaFeature) {
        geoJsonLayerRef.current.eachLayer((layer) => {
          if (layer.feature.properties?.Murabba_No === onMurabbaSelect) {
            layer.fire("programmaticSelect");
          }
        });
      } else {
        console.warn("No layer found for selected Murabba:", onMurabbaSelect);
      }
    }
  }, [onMurabbaSelect]);

  return null;
};

export default GeoJsonLoader;
