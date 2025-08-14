// src/Map Component/LocateControl.js

import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import locationIcon from './images/location.png';
import './css/LocateControl.css';

/**
 * Revised LocateControl:
 * 1. Once clicked, it immediately disables further clicks until the first fix.
 * 2. After the first fix (and zoom), it remains “active” and ignores any further clicks.
 * 3. There is no longer a built-in “toggle‐off” via a second click. (If you need a stop button later,
 *    you can add it separately.)
 */

const LocateControl = L.Control.extend({
  onAdd: function (map) {
    this._userMarker = null;
    this._accuracyCircle = null;
    this._watchId = null;
    this._intervalId = null;

    // Flag to know whether we've zoomed/panned to the first fix
    this._hasZoomedToLocation = false;

    // Create the button element
    const button = L.DomUtil.create('button', 'leaflet-location-icon');
    button.title = 'Track My Live Location';
    button.style.backgroundImage = `url('${locationIcon}')`;

    // Calculate averaged position from buffered readings:
    const calculateAverageLocation = (locations) => {
      const total = locations.reduce(
        (acc, loc) => ({
          latitude: acc.latitude + loc.latitude,
          longitude: acc.longitude + loc.longitude,
          accuracy: acc.accuracy + loc.accuracy,
        }),
        { latitude: 0, longitude: 0, accuracy: 0 }
      );
      const count = locations.length;
      return {
        latitude: total.latitude / count,
        longitude: total.longitude / count,
        accuracy: total.accuracy / count,
      };
    };

    // When we get an averaged reading, place/animate marker + circle
    const updateLocationDisplay = (latitude, longitude, accuracy) => {
      if (this._userMarker) {
        this._userMarker.setLatLng([latitude, longitude]);
      } else {
        const blinkingCircle = L.divIcon({
          className: 'blinking-location',
          html: `<div class="blinking-circle"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        this._userMarker = L.marker([latitude, longitude], {
          icon: blinkingCircle,
        }).addTo(map);
      }

      if (this._accuracyCircle) {
        this._accuracyCircle.setLatLng([latitude, longitude]);
        this._accuracyCircle.setRadius(accuracy);
      } else {
        this._accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          className: 'leaflet-accuracy-circle',
        }).addTo(map);
      }

      // Smoothly animate the map to the live location on each update
      map.flyTo([latitude, longitude], 18, {
        animate: true,
        duration: 2,
        easeLinearity: 0.5,
      });
      this._hasZoomedToLocation = true;
    };

    // Start the Geolocation watch + buffer readings
    const startTracking = () => {
      if (!('geolocation' in navigator)) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      let locationBuffer = [];
      this._watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          locationBuffer.push({ latitude, longitude, accuracy });

          // Keep only the latest 50 readings
          if (locationBuffer.length > 50) {
            locationBuffer.shift();
          }
        },
        (error) => {
          console.error('Error retrieving location:', error.message);
          alert('Unable to retrieve location. Ensure GPS or internet is active.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

      // Every 5 seconds, compute average and update map
      this._intervalId = setInterval(() => {
        if (locationBuffer.length === 0) return;
        const { latitude, longitude, accuracy } = calculateAverageLocation(locationBuffer);
        updateLocationDisplay(latitude, longitude, accuracy);
        // Clear buffer so next interval only has new points
        locationBuffer = [];
      }, 5000);
    };

    // Disable further clicks once tracking has begun:
    const onButtonClick = () => {
      // If we've already started watchPosition, ignore any further clicks
      if (this._watchId !== null) {
        return;
      }

      // Mark button as “active” and start tracking
      this._watchId = -1; // placeholder indicating “we’ve started the process”
      this._hasZoomedToLocation = false;
      L.DomUtil.addClass(button, 'leaflet-location-icon-active');
      button.title = 'Locating…';

      startTracking();
    };

    L.DomEvent.on(button, 'click', onButtonClick);

    return button;
  },

  onRemove: function (map) {
    // Clean up geolocation
    if (this._watchId !== null && this._watchId !== -1) {
      navigator.geolocation.clearWatch(this._watchId);
    }
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
    }
    // Remove marker/circle if still present
    if (this._userMarker) {
      map.removeLayer(this._userMarker);
    }
    if (this._accuracyCircle) {
      map.removeLayer(this._accuracyCircle);
    }
  },
});

const LocateControlComponent = () => {
  const map = useMap();
  useEffect(() => {
    const control = new LocateControl({ position: 'topleft' });
    map.addControl(control);
    return () => {
      map.removeControl(control);
    };
  }, [map]);

  return null;
};

export default LocateControlComponent;
