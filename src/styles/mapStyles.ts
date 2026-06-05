import skeletonStyle from "./skeleton-style.json";
import premiumStyle from "./premium-style.json";
import highwayFocusedStyle from "./highway-focused.json";
import hfV2Style from "./hf-v2.json";
import hfV3Style from "./hf-v3.json";

export const MAP_STYLES: { id: string; label: string; styles: google.maps.MapTypeStyle[] }[] = [
  {
    id: "default",
    label: "Default",
    styles: [],
  },
  {
    id: "snazzy-silver",
    label: "Snazzy Silver",
    styles: [
      {
        featureType: "all",
        elementType: "geometry.stroke",
        stylers: [{ color: "#f2ede3" }, { weight: "3.00" }],
      },
      {
        featureType: "all",
        elementType: "labels",
        stylers: [{ visibility: "off" }, { color: "#2a2420" }],
      },
      {
        featureType: "landscape",
        elementType: "all",
        stylers: [{ visibility: "on" }, { color: "#f2ede3" }],
      },
      {
        featureType: "landscape.man_made",
        elementType: "geometry.fill",
        stylers: [{ color: "#ede8dc" }],
      },
      {
        featureType: "landscape.man_made",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.medical",
        elementType: "all",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.park",
        elementType: "all",
        stylers: [{ visibility: "on" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#c8d4b8" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.fill",
        stylers: [{ color: "#2c2c2a" }, { weight: "7.00" }],
      },
      {
        featureType: "road.arterial",
        elementType: "all",
        stylers: [{ visibility: "on" }],
      },
      {
        featureType: "road.arterial",
        elementType: "geometry.fill",
        stylers: [{ color: "#6b6860" }],
      },
      {
        featureType: "road.arterial",
        elementType: "geometry.stroke",
        stylers: [{ color: "#f2ede3" }],
      },
      {
        featureType: "road.arterial",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "road.local",
        elementType: "all",
        stylers: [{ visibility: "on" }, { color: "#ffffff" }],
      },
      {
        featureType: "road.local",
        elementType: "geometry.fill",
        stylers: [{ color: "#c8c2b6" }],
      },
      {
        featureType: "road.local",
        elementType: "labels",
        stylers: [{ visibility: "off" }, { color: "#ff0000" }],
      },
      {
        featureType: "transit.line",
        elementType: "all",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "transit.station.airport",
        elementType: "labels.text",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "transit.station.airport",
        elementType: "labels.icon",
        stylers: [{ visibility: "on" }],
      },
      {
        featureType: "transit.station.rail",
        elementType: "all",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#c8d8dc" }],
      },
    ],
  },
  {
    id: "skeleton-style",
    label: "Skeleton Style",
    styles: skeletonStyle as google.maps.MapTypeStyle[],
  },
  {
    id: "premium-style",
    label: "Premium Style",
    styles: premiumStyle as google.maps.MapTypeStyle[],
  },
  {
    id: "highway-focused",
    label: "Highway Focused",
    styles: highwayFocusedStyle as google.maps.MapTypeStyle[],
  },
  {
    id: "hf-v2",
    label: "HF v2",
    styles: hfV2Style as google.maps.MapTypeStyle[],
  },
  {
    id: "hf-v3",
    label: "HF v3",
    styles: hfV3Style as google.maps.MapTypeStyle[],
  },
];
