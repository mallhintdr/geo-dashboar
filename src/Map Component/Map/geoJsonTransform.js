import * as turf from "@turf/turf";
import L from "leaflet";
import MustateelGeojson from "./MustateelGeojson";
import { bindKillaTooltip } from "./bindTooltips";

export const transformGeoJsonWithTurf = (geojsonData, topLeft, topRight, bottomRight, bottomLeft) => {
  const matrixSize = 5;
  const width = turf.distance(turf.point(topLeft), turf.point(topRight), { units: "meters" });
  const height = turf.distance(turf.point(topLeft), turf.point(bottomLeft), { units: "meters" });
  const cellWidth = width / matrixSize;
  const cellHeight = height / matrixSize;
  const bearingTop = turf.bearing(turf.point(topLeft), turf.point(topRight));
  const bearingLeft = turf.bearing(turf.point(topLeft), turf.point(bottomLeft));

  geojsonData.features.forEach((feature, index) => {
    const col = index % matrixSize;
    const row = Math.floor(index / matrixSize);
    const cellOrigin = turf.destination(
      turf.destination(turf.point(topLeft), col * cellWidth, bearingTop, { units: "meters" }),
      row * cellHeight,
      bearingLeft,
      { units: "meters" }
    );

    const cellTopLeft = cellOrigin;
    const cellTopRight = turf.destination(cellTopLeft, cellWidth, bearingTop, { units: "meters" });
    const cellBottomLeft = turf.destination(cellTopLeft, cellHeight, bearingLeft, { units: "meters" });
    const cellBottomRight = turf.destination(cellTopRight, cellHeight, bearingLeft, { units: "meters" });

    const newCoords = [
      [cellTopLeft.geometry.coordinates, cellTopRight.geometry.coordinates, cellBottomRight.geometry.coordinates, cellBottomLeft.geometry.coordinates, cellTopLeft.geometry.coordinates]
    ];

    feature.geometry.coordinates = newCoords;
  });

  return geojsonData;
};

export const handleMurabbaClick = (murabbaFeature, map, mustateelLayers) => {
  const murabbaCoordinates = murabbaFeature.geometry.coordinates[0];
  const topLeft = murabbaCoordinates[0];
  const topRight = murabbaCoordinates[1];
  const bottomRight = murabbaCoordinates[2];
  const bottomLeft = murabbaCoordinates[3];

  const transformedGeojson = transformGeoJsonWithTurf({ ...MustateelGeojson }, topLeft, topRight, bottomRight, bottomLeft);

  if (mustateelLayers.current.length >= 4) {
    map.removeLayer(mustateelLayers.current.shift()); // Remove the oldest layer if there are already 4
  }

  const mustateelLayer = L.geoJSON(transformedGeojson, {
    style: {
      color: "#FFD700",
      weight: 2,
      fillOpacity: 0,
    },
    onEachFeature: (feature, layer) => {
      bindKillaTooltip(feature, layer, map);
    },
  }).addTo(map);

  mustateelLayers.current.push(mustateelLayer); // Add the new layer to the array
  map.fitBounds(mustateelLayer.getBounds());
};

